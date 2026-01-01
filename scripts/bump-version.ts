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

function runCommand(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch (error) {
    console.error(`Error executing command: ${command}`);
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
    const status = runCommand("git status --porcelain");
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
  const type = await question("Bump type (major, minor, patch) [patch]: ");
  const bumpType = (type.toLowerCase() || "patch") as "major" | "minor" | "patch";

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

    // Update root Cargo.toml
    let rootCargo = readFileSync(rootCargoPath, "utf-8");
    rootCargo = rootCargo.replace(
      /(\[workspace\.package\][\s\S]*?version\s*=\s*)"[^"]+"/,
      `$1"${newVersion}"`
    );
    writeFileSync(rootCargoPath, rootCargo);

    // Update src-tauri Cargo.toml
    let tauriCargo = readFileSync(tauriCargoPath, "utf-8");
    tauriCargo = tauriCargo.replace(
      /(\[package\][\s\S]*?name\s*=\s*"dbfordevs"[\s\S]*?version\s*=\s*)"[^"]+"/,
      `$1"${newVersion}"`
    );
    writeFileSync(tauriCargoPath, tauriCargo);
  }

  // 2. Update CHANGELOG.md
  if (existsSync(changelogPath)) {
    const today = new Date().toISOString().split("T")[0];
    const changelog = readFileSync(changelogPath, "utf-8");

    // Look for ## [Unreleased] or insert at top
    const unreleasedHeader = "## [Unreleased]";
    const newVersionHeader = `## [${newVersion}] - ${today}`;

    let newChangelog = "";
    if (changelog.includes(unreleasedHeader)) {
      newChangelog = changelog.replace(unreleasedHeader, `${unreleasedHeader}\n\n${newVersionHeader}`);
    } else {
      // Insert after # Changelog and its description
      const lines = changelog.split("\n");
      let insertIndex = lines.findIndex(l => l.startsWith("## "));
      if (insertIndex === -1) insertIndex = 3; // Fallback

      lines.splice(insertIndex, 0, newVersionHeader, "");
      newChangelog = lines.join("\n");
    }

    if (isDryRun) {
      console.log(`[DRY RUN] Would update CHANGELOG.md with header: ${newVersionHeader}`);
    } else {
      writeFileSync(changelogPath, newChangelog);
    }
  }

  // 3. Git Integration
  if (!isDryRun) {
    try {
      const commitOrTag = await question("Stage, commit and tag these changes? (y/N): ");
      if (commitOrTag.toLowerCase() === "y") {
        console.log("📝 Staging changes...");
        runCommand(`git add "${packageJsonPath}" "${tauriConfPath}" "${rootCargoPath}" "${tauriCargoPath}" "${changelogPath}"`);
        runCommand(`git commit -m "chore: bump version to ${newVersion}"`);
        runCommand(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
        console.log(`✅ Committed and tagged as v${newVersion}`);
      } else {
        console.log("📝 Changes modified on disk but NOT staged/committed.");
      }
    } catch (e) {
      console.warn("⚠️ Failed to execute git commands. Please check manually.", e);
    }
  }

  console.log("✨ Successfully process completed!");
  rl.close();
}

bumpVersion().catch(console.error);
