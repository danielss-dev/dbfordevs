import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline";
import { execSync } from "node:child_process";

// ─── Types & Constants ───────────────────────────────────────────────────────

type BumpType = "major" | "minor" | "patch";

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

interface CLIOptions {
  isDryRun: boolean;
  skipChangelog: boolean;
  skipCommit: boolean;
  createTag: boolean;
  explicitVersion: string | null;
  bumpType: BumpType | null;
}

interface VersionFilePaths {
  packageJson: string;
  tauriConf: string;
  rootCargo: string;
  tauriCargo: string;
  changelog: string;
}

interface FileBackup {
  path: string;
  content: string;
}

interface ChangelogResult {
  entry: string;
  header: string;
}

const BUMP_TYPES: readonly BumpType[] = ["major", "minor", "patch"] as const;

const CATEGORY_MAP: Record<string, string> = {
  feat: "Added",
  new: "Added",
  fix: "Fixed",
  bugfix: "Fixed",
  perf: "Changed",
  refactor: "Changed",
  style: "Changed",
  deprecated: "Deprecated",
  remove: "Removed",
  security: "Security",
  docs: "Other",
  chore: "Other",
  test: "Other",
  ci: "Other",
  build: "Other",
};

const NOISE_PREFIXES = new Set(["docs", "chore", "test", "ci", "build"]);

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function isValidBumpType(value: string): value is BumpType {
  return (BUMP_TYPES as readonly string[]).includes(value);
}

function parseArgs(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  const options: CLIOptions = {
    isDryRun: false,
    skipChangelog: false,
    skipCommit: false,
    createTag: false,
    explicitVersion: null,
    bumpType: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--dry-run":
        options.isDryRun = true;
        break;
      case "--skip-changelog":
        options.skipChangelog = true;
        break;
      case "--skip-commit":
        options.skipCommit = true;
        break;
      case "--tag":
        options.createTag = true;
        break;
      case "--version": {
        const next = args[i + 1];
        if (!next || next.startsWith("--")) {
          console.error("❌ Error: --version requires a value (e.g. --version 1.2.3)");
          printUsage();
          process.exit(1);
        }
        // Validate the version string parses correctly
        parseSemVer(next); // throws on invalid
        options.explicitVersion = next;
        i++; // skip next arg
        break;
      }
      default:
        if (arg.startsWith("--")) {
          console.error(`❌ Error: Unknown flag "${arg}"`);
          printUsage();
          process.exit(1);
        }
        // Positional arg: must be a bump type
        const lower = arg.toLowerCase();
        if (isValidBumpType(lower)) {
          options.bumpType = lower;
        } else {
          console.error(`❌ Error: Unknown argument "${arg}". Expected one of: ${BUMP_TYPES.join(", ")}`);
          printUsage();
          process.exit(1);
        }
        break;
    }
  }

  if (options.explicitVersion && options.bumpType) {
    console.error("❌ Error: --version and a bump type (major/minor/patch) are mutually exclusive.");
    printUsage();
    process.exit(1);
  }

  return options;
}

function printUsage(): void {
  console.log(`
Usage: bun scripts/bump-version.ts [options] [major|minor|patch]

Options:
  --dry-run         Show what would happen without making changes
  --skip-changelog  Skip changelog generation/update
  --skip-commit     Skip the commit prompt entirely
  --tag             Create annotated git tag vX.Y.Z after commit
  --version X.Y.Z   Set an explicit version (mutually exclusive with bump type)
`);
}

// ─── Version Logic ───────────────────────────────────────────────────────────

function parseSemVer(version: string): SemVer {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semver format: "${version}". Expected X.Y.Z`);
  }
  const [, maj, min, pat] = match;
  const major = Number(maj);
  const minor = Number(min);
  const patch = Number(pat);
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    throw new Error(`Invalid semver components in "${version}"`);
  }
  return { major, minor, patch };
}

function bumpSemVer(version: SemVer, type: BumpType): SemVer {
  switch (type) {
    case "major":
      return { major: version.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: version.major, minor: version.minor + 1, patch: 0 };
    case "patch":
      return { major: version.major, minor: version.minor, patch: version.patch + 1 };
  }
}

function formatSemVer(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

// ─── File Operations ─────────────────────────────────────────────────────────

function getFilePaths(): VersionFilePaths {
  const root = process.cwd();
  return {
    packageJson: join(root, "package.json"),
    tauriConf: join(root, "src-tauri", "tauri.conf.json"),
    rootCargo: join(root, "Cargo.toml"),
    tauriCargo: join(root, "src-tauri", "Cargo.toml"),
    changelog: join(root, "CHANGELOG.md"),
  };
}

function validateFilesExist(paths: VersionFilePaths): void {
  const required: [string, string][] = [
    [paths.packageJson, "package.json"],
    [paths.tauriConf, "src-tauri/tauri.conf.json"],
    [paths.rootCargo, "Cargo.toml"],
    [paths.tauriCargo, "src-tauri/Cargo.toml"],
  ];
  for (const [filePath, label] of required) {
    if (!existsSync(filePath)) {
      throw new Error(`Required file not found: ${label} (${filePath})`);
    }
  }
}

function backupFiles(paths: VersionFilePaths): FileBackup[] {
  const filesToBackup = [paths.packageJson, paths.tauriConf, paths.rootCargo, paths.tauriCargo];
  if (existsSync(paths.changelog)) {
    filesToBackup.push(paths.changelog);
  }
  return filesToBackup.map((p) => ({
    path: p,
    content: readFileSync(p, "utf-8"),
  }));
}

function restoreFiles(backups: FileBackup[]): void {
  for (const backup of backups) {
    try {
      writeFileSync(backup.path, backup.content);
    } catch {
      console.error(`❌ Failed to restore ${backup.path}`);
    }
  }
}

function updateVersionFiles(paths: VersionFilePaths, newVersion: string): void {
  // package.json
  const packageJson = JSON.parse(readFileSync(paths.packageJson, "utf-8"));
  packageJson.version = newVersion;
  writeFileSync(paths.packageJson, JSON.stringify(packageJson, null, 2) + "\n");

  // tauri.conf.json
  const tauriConf = JSON.parse(readFileSync(paths.tauriConf, "utf-8"));
  tauriConf.version = newVersion;
  writeFileSync(paths.tauriConf, JSON.stringify(tauriConf, null, 2) + "\n");

  // root Cargo.toml ([workspace.package] section)
  let rootCargo = readFileSync(paths.rootCargo, "utf-8");
  const rootCargoUpdated = rootCargo.replace(
    /^(\[workspace\.package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
    `$1"${newVersion}"`
  );
  if (rootCargoUpdated === rootCargo) {
    throw new Error("Failed to update version in root Cargo.toml — regex did not match [workspace.package] version");
  }
  writeFileSync(paths.rootCargo, rootCargoUpdated);

  // src-tauri/Cargo.toml ([package] section)
  let tauriCargo = readFileSync(paths.tauriCargo, "utf-8");
  const tauriCargoUpdated = tauriCargo.replace(
    /^(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
    `$1"${newVersion}"`
  );
  if (tauriCargoUpdated === tauriCargo) {
    throw new Error("Failed to update version in src-tauri/Cargo.toml — regex did not match [package] version");
  }
  writeFileSync(paths.tauriCargo, tauriCargoUpdated);
}

// ─── Git Operations ──────────────────────────────────────────────────────────

function runCommand(command: string, silent: boolean = false): string {
  try {
    if (!silent) console.log(`Executing: ${command}`);
    return execSync(command, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (error) {
    if (!silent) console.error(`Error executing command: ${command}`);
    throw error;
  }
}

function isGitRepo(): boolean {
  try {
    runCommand("git rev-parse --is-inside-work-tree", true);
    return true;
  } catch {
    return false;
  }
}

function isWorkingDirClean(): boolean {
  const status = runCommand("git status --porcelain", true);
  return status === "";
}

function getLastVersionReference(currentVersion: string): string {
  const currentTag = `v${currentVersion}`;

  // Priority 1: tag matching current version
  try {
    runCommand(`git rev-parse --verify ${currentTag}`, true);
    return currentTag;
  } catch {
    // tag doesn't exist
  }

  // Priority 2: latest tag by version sort
  try {
    const tags = runCommand("git tag --sort=-v:refname", true);
    const firstTag = tags.split("\n")[0];
    if (firstTag) return firstTag;
  } catch {
    // no tags
  }

  // Priority 3: git describe
  try {
    return runCommand("git describe --tags --abbrev=0", true);
  } catch {
    return "";
  }
}

function getCommitsSince(reference: string): string[] {
  let logs: string;
  if (reference) {
    console.log(`Fetching commits since ${reference}...`);
    logs = runCommand(`git log ${reference}..HEAD --oneline --pretty=format:%s`, true);
  } else {
    console.log("No previous tag found. Fetching last 20 commits...");
    logs = runCommand("git log -n 20 --oneline --pretty=format:%s", true);
  }
  if (!logs) return [];
  // Strip potential surrounding quotes from each line (Windows git can add them)
  return logs.split("\n").map((line) => line.replace(/^"|"$/g, ""));
}

function getChangedVersionFiles(paths: VersionFilePaths): string[] {
  const candidates = [
    paths.packageJson,
    paths.tauriConf,
    paths.rootCargo,
    paths.tauriCargo,
    paths.changelog,
    join(process.cwd(), "bun.lock"),
    join(process.cwd(), "Cargo.lock"),
  ];
  const changed: string[] = [];
  for (const filePath of candidates) {
    try {
      const status = runCommand(`git status --porcelain "${filePath}"`, true);
      if (status) changed.push(filePath);
    } catch {
      // skip
    }
  }
  return changed;
}

function stageAndCommit(files: string[], newVersion: string): void {
  if (files.length === 0) {
    console.log("No changed files to stage.");
    return;
  }
  const fileArgs = files.map((f) => `"${f}"`).join(" ");
  runCommand(`git add ${fileArgs}`);
  runCommand(`git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`✅ Committed changes for v${newVersion}`);
}

function createGitTag(version: string): void {
  const tag = `v${version}`;
  runCommand(`git tag -a ${tag} -m "Release ${tag}"`);
  console.log(`🏷️ Created tag ${tag}`);
}

// ─── Changelog Generation ────────────────────────────────────────────────────

function categorizeCommits(commitLines: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {
    Added: [],
    Changed: [],
    Deprecated: [],
    Removed: [],
    Fixed: [],
    Security: [],
  };

  for (const line of commitLines) {
    const lowerLine = line.toLowerCase();

    // Filter out version bump commits
    if (lowerLine.includes("bump version") || lowerLine.includes("chore: release")) continue;

    // Match conventional commit format: "type(scope): description" or "type: description"
    const conventionalMatch = line.match(/^(\w+)(?:\(.*?\))?:\s*(.*)/);

    if (conventionalMatch) {
      const type = conventionalMatch[1].toLowerCase();
      const description = conventionalMatch[2];

      // Skip noise commits
      if (NOISE_PREFIXES.has(type)) continue;

      const category = CATEGORY_MAP[type] || "Changed";
      if (grouped[category]) {
        grouped[category].push(`- ${description}`);
      }
    } else {
      // Fallback: detect by starting keywords
      let category = "Changed";
      if (lowerLine.startsWith("add") || lowerLine.startsWith("new") || lowerLine.startsWith("feat")) {
        category = "Added";
      } else if (lowerLine.startsWith("fix") || lowerLine.startsWith("bug")) {
        category = "Fixed";
      } else if (lowerLine.startsWith("deprecat")) {
        category = "Deprecated";
      } else if (lowerLine.startsWith("remov")) {
        category = "Removed";
      } else if (lowerLine.startsWith("security") || lowerLine.startsWith("vuln")) {
        category = "Security";
      }
      grouped[category].push(`- ${line}`);
    }
  }

  return grouped;
}

function buildChangelogEntry(grouped: Record<string, string[]>): string {
  let entry = "";
  for (const [category, commits] of Object.entries(grouped)) {
    if (commits.length > 0) {
      entry += `\n### ${category}\n${commits.join("\n")}\n`;
    }
  }
  return entry;
}

function updateChangelogFile(
  changelogPath: string,
  newVersion: string,
  changelogEntry: string,
  isDryRun: boolean
): void {
  if (!existsSync(changelogPath)) {
    console.log("No CHANGELOG.md found. Skipping changelog update.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const newVersionHeader = `## [${newVersion}] - ${today}`;
  const changelog = readFileSync(changelogPath, "utf-8");

  const unreleasedHeader = "## [Unreleased]";
  let newChangelog: string;

  if (changelog.includes(unreleasedHeader)) {
    newChangelog = changelog.replace(
      unreleasedHeader,
      `${unreleasedHeader}\n\n${newVersionHeader}\n${changelogEntry}`
    );
  } else {
    const lines = changelog.split("\n");
    let insertIndex = lines.findIndex((l) => l.startsWith("## "));
    if (insertIndex === -1) insertIndex = 3;

    const block = [`${newVersionHeader}\n${changelogEntry}`];
    lines.splice(insertIndex, 0, ...block);
    newChangelog = lines.join("\n");
  }

  if (isDryRun) {
    console.log(`[DRY RUN] Would update CHANGELOG.md with header: ${newVersionHeader}`);
    if (changelogEntry) {
      console.log(changelogEntry);
    }
  } else {
    writeFileSync(changelogPath, newChangelog);
    console.log("📝 Updated CHANGELOG.md");
  }
}

// ─── User Interaction ────────────────────────────────────────────────────────

let _rl: Interface | null = null;

function createPrompt(): Interface {
  if (!_rl) {
    _rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return _rl;
}

function closePrompt(): void {
  if (_rl) {
    _rl.close();
    _rl = null;
  }
}

function question(query: string): Promise<string> {
  const rl = createPrompt();
  return new Promise((resolve) => rl.question(query, resolve));
}

async function promptBumpType(): Promise<BumpType> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const input = await question("Bump type (major, minor, patch) [patch]: ");
    const value = input.trim().toLowerCase() || "patch";
    if (isValidBumpType(value)) {
      return value;
    }
    console.error(`❌ Invalid bump type "${input}". Expected one of: ${BUMP_TYPES.join(", ")}`);
  }
  console.error("Too many invalid attempts. Defaulting to patch.");
  return "patch";
}

async function promptConfirm(message: string): Promise<boolean> {
  const answer = await question(message);
  return answer.trim().toLowerCase() === "y";
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  if (options.isDryRun) {
    console.log("🏃 Dry run mode enabled. No changes will be written to disk or git.");
  }

  // 1. Git safety checks
  if (isGitRepo()) {
    if (!options.isDryRun && !isWorkingDirClean()) {
      console.error("❌ Error: Git working directory is not clean. Please commit or stash changes first.");
      process.exit(1);
    }
  } else {
    console.warn("⚠️ Warning: Not in a git repository or git not found. Skipping git safety checks.");
  }

  // 2. Validate version files exist
  const paths = getFilePaths();
  validateFilesExist(paths);

  // 3. Read current version
  const packageJson = JSON.parse(readFileSync(paths.packageJson, "utf-8"));
  const currentVersion: string = packageJson.version;
  const currentSemVer = parseSemVer(currentVersion);
  console.log(`Current version: ${currentVersion}`);

  // 4. Determine new version
  let newVersion: string;

  if (options.explicitVersion) {
    newVersion = options.explicitVersion;
  } else {
    let bumpType: BumpType;
    if (options.bumpType) {
      bumpType = options.bumpType;
    } else {
      bumpType = await promptBumpType();
    }
    newVersion = formatSemVer(bumpSemVer(currentSemVer, bumpType));
  }

  console.log(`Bumping to: ${newVersion}`);

  // 5. Update version files
  if (options.isDryRun) {
    console.log(`[DRY RUN] Would update package.json, tauri.conf.json, Cargo.toml files to ${newVersion}`);
  } else {
    const backups = backupFiles(paths);
    try {
      updateVersionFiles(paths, newVersion);
    } catch (error) {
      console.error("❌ Error updating version files. Rolling back...");
      restoreFiles(backups);
      throw error;
    }

    // Update lock files
    console.log("📦 Updating lock files...");
    try {
      runCommand("bun install");
      runCommand("cargo update -p dbfordevs");
    } catch {
      console.warn("⚠️ Failed to update lock files automatically. You may need to run 'bun install' or 'cargo build' manually.");
    }
  }

  // 6. Changelog
  if (!options.skipChangelog) {
    let changelogEntry = "";
    if (isGitRepo()) {
      try {
        const lastRef = getLastVersionReference(currentVersion);
        const commits = getCommitsSince(lastRef);
        if (commits.length > 0) {
          const grouped = categorizeCommits(commits);
          changelogEntry = buildChangelogEntry(grouped);
        }
      } catch {
        console.warn("⚠️ Could not fetch git logs for changelog. Using empty section.");
      }
    }
    updateChangelogFile(paths.changelog, newVersion, changelogEntry, options.isDryRun);
  } else {
    console.log("Skipping changelog (--skip-changelog).");
  }

  // 7. Git commit
  if (!options.isDryRun && !options.skipCommit) {
    try {
      const shouldCommit = await promptConfirm("Stage and commit these changes? (y/N): ");
      if (shouldCommit) {
        console.log("📝 Staging and committing changes...");
        const changedFiles = getChangedVersionFiles(paths);
        stageAndCommit(changedFiles, newVersion);

        // 8. Optional tag
        if (options.createTag) {
          createGitTag(newVersion);
        }
      } else {
        console.log("📝 Changes modified on disk but NOT staged/committed.");
      }
    } catch (e) {
      console.warn("⚠️ Failed to execute git commands. Please check manually.", e);
    }
  } else if (options.isDryRun && options.createTag) {
    console.log(`[DRY RUN] Would create tag v${newVersion}`);
  }

  console.log("✨ Version bump process completed successfully!");
}

main()
  .catch((error) => {
    console.error("❌ Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => {
    closePrompt();
  });
