#!/usr/bin/env node
/**
 * Multiwarden branding, applied to a finished extension build.
 *
 * Branding is done after the build, not in Bitwarden's source files, so that upstream
 * changes to locales, manifests and images never conflict with Multiwarden's.
 *
 * Usage: node multiwarden/scripts/brand-build.mjs [buildDir] [--store]
 *   buildDir defaults to apps/browser/build
 *   --store  build for an extension store: leaves out the manifest "key" (stores refuse it
 *            and give the listing its own ID)
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const forStore = args.includes("--store");
const buildDir = resolve(
  args.find((arg) => !arg.startsWith("--")) ?? join(root, "apps/browser/build"),
);
const iconsDir = join(root, "multiwarden/branding/icons");

const NAME = "Multiwarden";
// Chrome limits: name <= 45 chars, description <= 132 chars.
const EXT_NAME = "Multiwarden: multi-account vaults";
const EXT_DESC =
  "All your vaults, working as one. Unofficial fork of the Bitwarden extension: autofill, saving and passkeys across accounts.";
const HOMEPAGE = "https://github.com/multiwarden/clients";
const GECKO_ID = "multiwarden@mteij.nl";

if (!existsSync(join(buildDir, "manifest.json"))) {
  console.error(`No manifest.json in ${buildDir}. Build the extension first.`);
  process.exit(1);
}

// 1. Manifest. Multiwarden's version is Bitwarden's version plus a fourth number for the
// Multiwarden release (multiwarden/version.json), e.g. 2026.11.0.3.
const manifestPath = join(buildDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const bitwardenVersion = manifest.version.split(".").slice(0, 3).join(".");
const { release } = JSON.parse(readFileSync(join(root, "multiwarden/version.json"), "utf8"));
const version = `${bitwardenVersion}.${release}`;
manifest.version = version;
delete manifest.version_name;
manifest.short_name = NAME;
manifest.author = "Multiwarden contributors";
manifest.homepage_url = HOMEPAGE;
if (manifest.action) {
  manifest.action.default_title = NAME;
}
if (manifest.browser_action) {
  manifest.browser_action.default_title = NAME;
}
if (manifest.sidebar_action) {
  manifest.sidebar_action.default_title = NAME;
}
// Firefox: Bitwarden's add-on ID belongs to their listing; Multiwarden needs its own.
if (manifest.browser_specific_settings?.gecko) {
  manifest.browser_specific_settings.gecko.id = GECKO_ID;
}
if (manifest.applications?.gecko) {
  manifest.applications.gecko.id = GECKO_ID;
}
// Chromium: a fixed public key gives every GitHub build the same extension ID
// (geefkjbbjaipgadampajlkghfamlljll), so updating an unpacked install keeps its data and
// links to chrome-extension://<id>/ keep working. Firefox uses the gecko ID above instead.
// BROWSER is the same variable the webpack build uses; it defaults to chrome.
const isChromium =
  ["chrome", "edge", "opera"].includes(process.env.BROWSER ?? "chrome") &&
  !manifest.browser_specific_settings?.gecko &&
  !manifest.applications?.gecko;
delete manifest.key;
if (isChromium && !forStore) {
  manifest.key = readFileSync(join(root, "multiwarden/branding/extension-key.txt"), "utf8").trim();
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// 2. Extension name and description, and Multiwarden's own strings, in every locale.
// The popup does not fall back to English for missing strings, so every locale gets the
// English `multiwarden*` strings, overridden by multiwarden/locales/<locale>.json if present.
const localesDir = join(buildDir, "_locales");
const english = JSON.parse(readFileSync(join(localesDir, "en", "messages.json"), "utf8"));
const multiwardenStrings = Object.fromEntries(
  Object.entries(english).filter(([key]) => key.startsWith("multiwarden")),
);
let locales = 0;
for (const locale of readdirSync(localesDir)) {
  const file = join(localesDir, locale, "messages.json");
  if (!existsSync(file)) {
    continue;
  }
  const messages = JSON.parse(readFileSync(file, "utf8"));
  const translationsFile = join(root, "multiwarden/locales", `${locale}.json`);
  const translations = existsSync(translationsFile)
    ? JSON.parse(readFileSync(translationsFile, "utf8"))
    : {};
  Object.assign(messages, multiwardenStrings, translations);
  messages.extName = { message: EXT_NAME };
  messages.extDesc = { message: EXT_DESC };
  writeFileSync(file, JSON.stringify(messages));
  locales++;
}

// 3. Icons: replace every icon variant with Multiwarden's original artwork
const imagesDir = join(buildDir, "images");
let icons = 0;
for (const target of readdirSync(imagesDir)) {
  const match = target.match(/^icon(\d+)(_gray|_locked)?(_beta)?\.png$/);
  if (!match) {
    continue;
  }
  const [, size, variant = ""] = match;
  const source = join(iconsDir, `icon${size}${variant}.png`);
  const fallback = join(iconsDir, `icon${size}.png`);
  const from = existsSync(source) ? source : fallback;
  if (existsSync(from)) {
    copyFileSync(from, join(imagesDir, target));
    icons++;
  }
}

// 4. Version details for Settings → Multiwarden.
const upstreamCommit = readFileSync(join(root, "multiwarden/upstream-commit"), "utf8").trim();
writeFileSync(
  join(buildDir, "multiwarden.json"),
  JSON.stringify(
    {
      version,
      release,
      bitwardenVersion,
      upstreamCommit,
      repository: HOMEPAGE,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(
  `Branded ${buildDir} as Multiwarden ${version}${forStore ? " (store build)" : ""}: ` +
    `${locales} locales, ${icons} icons.`,
);
