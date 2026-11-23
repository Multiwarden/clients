#!/usr/bin/env node
/**
 * Multiwarden hook guard.
 *
 * Multiwarden changes Bitwarden's own files only through small hooks, each marked with a
 * `Multiwarden:` comment (see multiwarden/README.md). An upstream sync that merges badly can
 * silently drop a hook, and the build would still pass. This check compares every upstream
 * file against multiwarden/hooks.json and fails when a file has fewer `Multiwarden:` markers,
 * or fewer references to Multiwarden code, than recorded.
 *
 * Usage:
 *   node multiwarden/scripts/check-hooks.mjs           check (used by CI)
 *   node multiwarden/scripts/check-hooks.mjs --update  record the current hooks after
 *                                                      adding, moving or removing one
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hooksFile = join(root, "multiwarden/hooks.json");
const update = process.argv.includes("--update");

/** Files that belong to Multiwarden itself, rather than hooks in Bitwarden's files. */
function isMultiwardenFile(path) {
  return (
    path.startsWith("multiwarden/") ||
    path.includes("/multiwarden/") ||
    path.startsWith(".github/") ||
    path === "README.md"
  );
}

function count(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

function measure(path) {
  const text = readFileSync(join(root, path), "utf8");
  return {
    markers: count(text, /Multiwarden:/g),
    references: count(text, /multiwarden/gi),
  };
}

if (update) {
  const listed = execFileSync("git", ["grep", "-l", "Multiwarden:"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((path) => path && !isMultiwardenFile(path))
    .sort();
  const hooks = Object.fromEntries(listed.map((path) => [path, measure(path)]));
  writeFileSync(hooksFile, JSON.stringify(hooks, null, 2) + "\n");
  console.log(`Recorded hooks in ${listed.length} upstream files in multiwarden/hooks.json.`);
  process.exit(0);
}

const hooks = JSON.parse(readFileSync(hooksFile, "utf8"));
const problems = [];
for (const [path, expected] of Object.entries(hooks)) {
  if (!existsSync(join(root, path))) {
    problems.push(`${path}: file is gone (upstream moved or deleted it; move the hook)`);
    continue;
  }
  const found = measure(path);
  if (found.markers < expected.markers) {
    problems.push(`${path}: ${found.markers} of ${expected.markers} "Multiwarden:" markers left`);
  } else if (found.references < expected.references) {
    problems.push(
      `${path}: ${found.references} of ${expected.references} references to Multiwarden code left`,
    );
  }
}

if (problems.length > 0) {
  console.error("Multiwarden hooks are missing:\n");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    "\nRestore the hooks (multiwarden/README.md lists what each one does). If a hook was " +
      "removed on purpose, run: node multiwarden/scripts/check-hooks.mjs --update",
  );
  process.exit(1);
}
console.log(`All Multiwarden hooks present in ${Object.keys(hooks).length} upstream files.`);
