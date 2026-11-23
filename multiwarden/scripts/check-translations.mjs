#!/usr/bin/env node
/**
 * Multiwarden: fails when a translation file in multiwarden/locales is missing a `multiwarden*`
 * string that exists in English, or has one English no longer has.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const english = JSON.parse(
  readFileSync(join(root, "apps/browser/src/_locales/en/messages.json"), "utf8"),
);
const expected = Object.keys(english).filter((key) => key.startsWith("multiwarden"));
let problems = 0;
for (const file of readdirSync(join(root, "multiwarden/locales"))) {
  const keys = Object.keys(
    JSON.parse(readFileSync(join(root, "multiwarden/locales", file), "utf8")),
  );
  const missing = expected.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !expected.includes(key));
  if (missing.length || extra.length) {
    problems++;
    console.error(`${file}: missing [${missing.join(", ")}] extra [${extra.join(", ")}]`);
  }
}
if (problems) {
  process.exit(1);
}
console.log(`All translation files have the ${expected.length} Multiwarden strings.`);
