import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

function runCommand(command: string, silent: boolean = false): string {
  try {
    if (!silent) console.log(`Executing: ${command}`);
    return execSync(command, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (error) {
    if (!silent) console.error(`Error executing command: ${command}`);
    throw error;
  }
}

async function bumpVersion() {
  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) {
    console.log("🏃 Dry run mode enabled. No changes will be written to disk or git.");
  }

  // 1. Safety Check: Git Cleanliness
  try {
    const status = runCommand("git status --porcelain", true);
    if (status && !isDryRun) {
      console.error("❌ Error: Git working directory is not clean. Please commit or stash changes first.");
      process.exit(1);
    }
  } catch (e) {
    console.warn("⚠️ Warning: Not in a git repository or git not found. Skipping safety checks.");
  }

  const packageJsonPath = join(process.cwd(), "package.json");
  const tauriConfPath = join(process.cwd(), "src-tauri", "tauri.conf.json");
  const rootCargoPath = join(process.cwd(), "Cargo.toml");
  const tauriCargoPath = join(process.cwd(), "src-tauri", "Cargo.toml");
  const changelogPath = join(process.cwd(), "CHANGELOG.md");

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const currentVersion = packageJson.version;

  console.log(`Current version: ${currentVersion}`);
  
  // Get bump type from args or prompt
  let bumpType: "major" | "minor" | "patch" = "patch";
  const typeArg = process.argv.find(arg => ["major", "minor", "patch"].includes(arg.toLowerCase()));
  
  if (typeArg) {
    bumpType = typeArg.toLowerCase() as any;
  } else {
    const type = await question("Bump type (major, minor, patch) [patch]: ");
    bumpType = (type.toLowerCase() || "patch") as any;
  }

  const [major, minor, patch] = currentVersion.split(".").map(Number);
  let newVersion = "";

  if (bumpType === "major") {
    newVersion = `${major + 1}.0.0`;
  } else if (bumpType === "minor") {
    newVersion = `${major}.${minor + 1}.0`;
  } else {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }

  console.log(`Bumping to: ${newVersion}`);

  if (isDryRun) {
    console.log(`[DRY RUN] Would update package.json, tauri.conf.json, Cargo.toml files to ${newVersion}`);
  } else {
    // Update package.json
    packageJson.version = newVersion;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

    // Update tauri.conf.json
    const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
    tauriConf.version = newVersion;
    writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");

    // Update root Cargo.toml ([workspace.package] section)
    let rootCargo = readFileSync(rootCargoPath, "utf-8");
    rootCargo = rootCargo.replace(
      /^(\[workspace\.package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
      `$1"${newVersion}"`
    );
    writeFileSync(rootCargoPath, rootCargo);

    // Update src-tauri Cargo.toml ([package] section)
    let tauriCargo = readFileSync(tauriCargoPath, "utf-8");
    tauriCargo = tauriCargo.replace(
      /^(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
      `$1"${newVersion}"`
    );
    writeFileSync(tauriCargoPath, tauriCargo);

    // 2. Update lock files
    console.log("📦 Updating lock files...");
    try {
      runCommand("bun install");
      // Use cargo update -p to specifically update our project version in the lock file
      // If that doesn't work, a simple cargo update might be needed
      runCommand("cargo update -p dbfordevs");
    } catch (e) {
      console.warn("⚠️ Failed to update lock files automatically. You may need to run 'bun install' or 'cargo build' manually.");
    }
  }

  // 3. Update CHANGELOG.md
  if (existsSync(changelogPath)) {
    const today = new Date().toISOString().split("T")[0];
    const changelog = readFileSync(changelogPath, "utf-8");

    const unreleasedHeader = "## [Unreleased]";
    const newVersionHeader = `## [${newVersion}] - ${today}`;

    // 3.1 Get git commits since last version
    let changelogEntry = "";
    try {
      // Priority 1: Use the tag corresponding to the current version
      // Priority 2: Use the latest tag found by git describe
      let lastReference = "";
      const currentTag = `v${currentVersion}`;
      
      try {
        // Check if currentTag exists
        runCommand(`git rev-parse --verify ${currentTag}`, true);
        lastReference = currentTag;
      } catch (e) {
        try {
          // Try to get the latest tag by version sorting
          lastReference = runCommand(`git tag --sort=-v:refname`, true).split("\n")[0];
        } catch (e2) {
          try {
            lastReference = runCommand(`git describe --tags --abbrev=0`, true);
          } catch (e3) {
            lastReference = "";
          }
        }
      }
      
      let commitLines: string[] = [];
      if (lastReference) {
        console.log(`Fetching commits since ${lastReference}...`);
        const logs = runCommand(`git log ${lastReference}..HEAD --oneline --pretty=format:"%s"`);
        commitLines = logs ? logs.split("\n") : [];
      } else {
        console.log("No previous tag found. Fetching last 10 commits...");
        const logs = runCommand(`git log -n 10 --oneline --pretty=format:"%s"`);
        commitLines = logs ? logs.split("\n") : [];
      }
      
      if (commitLines.length > 0) {
        // Categories mapping: prefix -> Standard Header
        const categoryMap: Record<string, string> = {
          feat: "Added",
          new: "Added",
          fix: "Fixed",
          bugfix: "Fixed",
          perf: "Changed",
          refactor: "Changed",
          style: "Changed",
          docs: "Other",
          chore: "Other",
          test: "Other",
          ci: "Other",
          build: "Other"
        };

        const groupedCommits: Record<string, string[]> = {
          Added: [],
          Changed: [],
          Fixed: [],
          Other: []
        };

        commitLines.forEach(line => {
          const lowerLine = line.toLowerCase();
          // Filter out version bump commits
          if (lowerLine.includes("bump version") || lowerLine.includes("chore: release")) return;

          // Match conventional commit format: "type(scope): description" or "type: description"
          const conventionalMatch = line.match(/^(\w+)(?:\(.*\))?:\s*(.*)/);
          
          if (conventionalMatch) {
            const type = conventionalMatch[1].toLowerCase();
            const description = conventionalMatch[2];
            const category = categoryMap[type] || "Changed";
            groupedCommits[category].push(`- **${type}**: ${description}`);
          } else {
            // Fallback: Detect by starting keywords
            let category = "Changed";
            if (lowerLine.startsWith("add") || lowerLine.startsWith("new") || lowerLine.startsWith("feat")) {
              category = "Added";
            } else if (lowerLine.startsWith("fix") || lowerLine.startsWith("bug")) {
              category = "Fixed";
            } else if (lowerLine.startsWith("chore") || lowerLine.startsWith("docs") || lowerLine.startsWith("test")) {
              category = "Other";
            }
            groupedCommits[category].push(`- ${line}`);
          }
        });

        // Build the changelog entry string
        for (const [category, commits] of Object.entries(groupedCommits)) {
          if (commits.length > 0) {
            changelogEntry += `\n\n### ${category}\n${commits.join("\n")}`;
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not fetch git logs for changelog. Using empty section.");
    }

    let newChangelog = "";
    if (changelog.includes(unreleasedHeader)) {
      // Content under [Unreleased] moves to the new version section
      newChangelog = changelog.replace(unreleasedHeader, `${unreleasedHeader}\n\n${newVersionHeader}${changelogEntry}`);
    } else {
      // Insert new version header after the initial description/link
      const lines = changelog.split("\n");
      let insertIndex = lines.findIndex(l => l.startsWith("## "));
      if (insertIndex === -1) insertIndex = 3;

      const newContent = [newVersionHeader, changelogEntry, ""].filter(Boolean);
      lines.splice(insertIndex, 0, ...newContent);
      newChangelog = lines.join("\n");
    }

    if (isDryRun) {
      console.log(`[DRY RUN] Would update CHANGELOG.md with header: ${newVersionHeader}${changelogEntry}`);
    } else {
      writeFileSync(changelogPath, newChangelog);
    }
  }

  // 4. Git Integration (Commit ONLY, no Tag)
  if (!isDryRun) {
    try {
      const commitChanges = await question("Stage and commit these changes? (y/N): ");
      if (commitChanges.toLowerCase() === "y") {
        console.log("📝 Staging and committing changes...");
        // Add all changed files including lock files
        runCommand("git add package.json src-tauri/tauri.conf.json Cargo.toml src-tauri/Cargo.toml CHANGELOG.md bun.lock Cargo.lock");
        runCommand(`git commit -m "chore: bump version to ${newVersion}"`);
        console.log(`✅ Committed changes for v${newVersion}`);
      } else {
        console.log("📝 Changes modified on disk but NOT staged/committed.");
      }
    } catch (e) {
      console.warn("⚠️ Failed to execute git commands. Please check manually.", e);
    }
  }

  console.log("✨ Version bump process completed successfully!");
  rl.close();
}

bumpVersion().catch(console.error);
