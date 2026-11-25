#!/usr/bin/env node
/**
 * Multiwarden branding for the desktop app, applied between the webpack build and packaging.
 *
 * Like the extension's brand-build.mjs, it changes the build output and writes its own
 * electron-builder config, so Bitwarden's source files, package.json and electron-builder.json
 * stay untouched and upstream syncs never conflict over branding.
 *
 * Usage (from the repository root, after `npm run build` in apps/desktop):
 *   node multiwarden/scripts/brand-desktop.mjs
 * Then package with:
 *   cd apps/desktop && npx electron-builder --config ../../multiwarden/.build/electron-builder.json ...
 *
 * What it does:
 * 1. build/package.json: name, product name and Linux desktop entry, so the app has its own
 *    data folder (Electron names it after the product), keychain service names and window
 *    titles.
 * 2. build/index.html, menu strings in build/locales: "Multiwarden" instead of "Bitwarden".
 * 3. build/images: Multiwarden's app and tray icons (multiwarden/branding/desktop).
 * 4. multiwarden/.build/electron-builder.json: own app ID, name, icons and artifact names; unsigned;
 *    Multiwarden's update feed instead of Bitwarden's; no App Group, provisioning profiles, store
 *    targets or Windows passkey plugin.
 * 5. build/multiwarden.json: version information, like the extension.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const desktopDir = join(root, "apps/desktop");
const buildDir = join(desktopDir, "build");
const brandingDir = join(root, "multiwarden/branding/desktop");

const NAME = "Multiwarden";
const APP_ID = "com.multiwarden.desktop";
const DESCRIPTION =
  "All your vaults, working as one. Unofficial fork of the Bitwarden desktop app with several unlocked accounts at once.";
const HOMEPAGE = "https://github.com/multiwarden/clients";
const AUTHOR = "Multiwarden contributors";

if (!existsSync(join(buildDir, "package.json"))) {
  console.error(`No package.json in ${buildDir}. Build the desktop app first (npm run build).`);
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

// Versions: the app keeps Bitwarden's version (Bitwarden's servers decide some features by client
// version); the Multiwarden version adds the release number from multiwarden/version.json.
const bitwardenVersion = readJson(join(desktopDir, "package.json")).version;
const { release } = readJson(join(root, "multiwarden/version.json"));
const version = `${bitwardenVersion}.${release}`;

// 1. The packaged app's package.json.
const packagePath = join(buildDir, "package.json");
const pkg = readJson(packagePath);
Object.assign(pkg, {
  name: "multiwarden",
  productName: NAME,
  desktopName: "multiwarden.desktop",
  description: DESCRIPTION,
  author: AUTHOR,
  homepage: HOMEPAGE,
  repository: { type: "git", url: `git+${HOMEPAGE}.git` },
});
writeJson(packagePath, pkg);

// 2. Visible names.
const indexPath = join(buildDir, "index.html");
if (existsSync(indexPath)) {
  writeFileSync(
    indexPath,
    readFileSync(indexPath, "utf8").replace("<title>Bitwarden</title>", `<title>${NAME}</title>`),
  );
}
const MENU_KEYS = ["bitwarden", "aboutBitwarden", "hideBitwarden", "quitBitwarden"];
const localesDir = join(buildDir, "locales");
for (const locale of existsSync(localesDir) ? readdirSync(localesDir) : []) {
  const path = join(localesDir, locale, "messages.json");
  if (!existsSync(path)) {
    continue;
  }
  const messages = readJson(path);
  for (const key of MENU_KEYS) {
    if (messages[key]?.message) {
      messages[key].message = messages[key].message.replaceAll("Bitwarden", NAME);
    }
  }
  writeJson(path, messages);
}

// 3. In-app and tray icons.
const imagesDir = join(brandingDir, "images");
for (const file of readdirSync(imagesDir)) {
  copyFileSync(join(imagesDir, file), join(buildDir, "images", file));
}

// 4. electron-builder config: Bitwarden's, with Multiwarden's identity.
const config = readJson(join(desktopDir, "electron-builder.json"));
const branding = (file) => `../../multiwarden/branding/desktop/${file}`;
const artifact = (suffix) => `${NAME}-${version}${suffix}`;

config.extraMetadata = { ...config.extraMetadata, name: "multiwarden" };
config.productName = NAME;
config.appId = APP_ID;
config.copyright = "Copyright © 2015-2026 Bitwarden Inc. and Multiwarden contributors";
config.buildVersion = version;
// Multiwarden's own update feed, never Bitwarden's (which would replace Multiwarden with Bitwarden).
// electron-builder writes the update files (latest*.yml) next to the packages; CI then puts the
// Multiwarden version in them (desktop-update-info.mjs) and attaches them to the release.
config.publish = {
  provider: "generic",
  url: "https://github.com/multiwarden/clients/releases/latest/download",
};
config.generateUpdatesFilesForAllChannels = false;
// Our afterPack runs Bitwarden's for Windows and Linux and handles unsigned macOS builds.
config.afterPack = "../../multiwarden/scripts/desktop-after-pack.cjs";
delete config.afterSign;
delete config.appxManifestCreated;
// bitwarden:// links are registered at run time, and only when Bitwarden doesn't have them
// (multiwardenMayHandleBitwardenLinks); macOS needs the scheme declared in the bundle for that.
delete config.protocols;

config.mac = {
  ...config.mac,
  icon: branding("icon.icns"),
  target: ["dmg", "zip"],
  // Ad-hoc signature: runs on Apple silicon; not notarized (needs an Apple Developer account).
  identity: "-",
  hardenedRuntime: false,
  gatekeeperAssess: false,
  protocols: [{ name: NAME, schemes: ["bitwarden"] }],
  artifactName: artifact("-mac-${arch}.${ext}"),
};
delete config.mac.provisioningProfile;
delete config.mac.entitlements;
delete config.mac.entitlementsInherit;
delete config.mac.extendInfo.BitwardenAppGroupIdentifier;
// Signed with the app (ad hoc), like every other binary in the bundle.
config.mac.signIgnore = (config.mac.signIgnore ?? []).filter((p) => !p.startsWith("MacOS/"));

config.dmg = {
  ...config.dmg,
  icon: branding("icon.icns"),
  artifactName: artifact("-mac-${arch}.${ext}"),
};

config.win = {
  ...config.win,
  icon: branding("icon.ico"),
  target: ["nsis", "portable"],
  // Bitwarden's Windows passkey plugin is registered under Bitwarden's identity; leave it out.
  extraFiles: config.win.extraFiles.filter((f) => !f.from.includes("windows_plugin_authenticator")),
  extraResources: [],
};
delete config.win.signtoolOptions;
delete config.win.signExts;
config.nsis = {
  oneClick: false,
  perMachine: false,
  allowToChangeInstallationDirectory: true,
  deleteAppDataOnUninstall: false,
  include: config.nsisWeb.include,
  artifactName: artifact("-Setup.${ext}"),
  uninstallDisplayName: NAME,
};
config.portable = { artifactName: artifact("-Portable.${ext}") };
delete config.nsisWeb;
delete config.appx;
delete config.mas;
delete config.snap;

config.linux = {
  ...config.linux,
  icon: branding("icons"),
  target: ["AppImage", "deb"],
  synopsis: "All your vaults, working as one.",
  executableName: "multiwarden",
  // The .deb package needs a maintainer.
  maintainer: "Multiwarden <mail@mteij.nl>",
  desktop: { entry: { Name: NAME, Type: "Application", GenericName: "Password Manager" } },
};
config.deb = { ...config.deb, artifactName: artifact("-${arch}.${ext}") };
config.appImage = { artifactName: artifact("-${arch}.${ext}") };
delete config.rpm;

// Paths in the config stay relative to apps/desktop, electron-builder's project directory.
const configDir = join(root, "multiwarden/.build");
mkdirSync(configDir, { recursive: true });
writeJson(join(configDir, "electron-builder.json"), config);

// 5. Version information.
writeJson(join(buildDir, "multiwarden.json"), {
  version,
  bitwardenVersion,
  upstreamCommit: readFileSync(join(root, "multiwarden/upstream-commit"), "utf8").trim(),
  repository: HOMEPAGE,
});

console.log(`Branded the desktop build as ${NAME} ${version} (Bitwarden ${bitwardenVersion}).`);
