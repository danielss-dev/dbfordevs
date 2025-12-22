import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

async function bumpVersion() {
  const packageJsonPath = join(process.cwd(), "package.json");
  const tauriConfPath = join(process.cwd(), "src-tauri", "tauri.conf.json");
  const rootCargoPath = join(process.cwd(), "Cargo.toml");
  const tauriCargoPath = join(process.cwd(), "src-tauri", "Cargo.toml");

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

  console.log("Successfully bumped version in all files!");
  rl.close();
}

bumpVersion().catch(console.error);
