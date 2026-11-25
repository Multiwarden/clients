#!/usr/bin/env node
/**
 * Multiwarden: writes the Multiwarden version into the desktop update files (latest.yml,
 * latest-linux.yml, latest-mac.yml) that electron-builder made in the given directory.
 *
 * The app keeps Bitwarden's version, so electron-builder writes Bitwarden's version there and
 * every Multiwarden release of one Bitwarden version would look the same to the updater. The
 * version written instead is the Multiwarden version as a semantic version: 2026.11.0.5 becomes
 * 2026.11.5 (patch * 1000 + release). apps/desktop/src/multiwarden/main/multiwarden-updates.ts
 * reads it back the same way.
 *
 * Usage: node multiwarden/scripts/desktop-update-info.mjs apps/desktop/dist
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = resolve(process.argv[2] ?? join(root, "apps/desktop/dist"));

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const bitwardenVersion = readJson(join(root, "apps/desktop/package.json")).version;
const { release } = readJson(join(root, "multiwarden/version.json"));
const [year, month, patch] = bitwardenVersion.split(".").map((part) => parseInt(part, 10));
const updaterVersion = `${year}.${month}.${(patch || 0) * 1000 + release}`;

const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^latest.*\.yml$/.test(f)) : [];
if (files.length === 0) {
  console.error(`No update files (latest*.yml) in ${dir}.`);
  process.exit(1);
}
for (const file of files) {
  const path = join(dir, file);
  const contents = readFileSync(path, "utf8");
  if (!/^version: .*$/m.test(contents)) {
    console.error(`${file} has no version line.`);
    process.exit(1);
  }
  writeFileSync(path, contents.replace(/^version: .*$/m, `version: ${updaterVersion}`));
  console.log(`${file}: version ${updaterVersion} (Multiwarden ${bitwardenVersion}.${release})`);
}
