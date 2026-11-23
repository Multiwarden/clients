/**
 * Multiwarden: electron-builder afterPack for the desktop app (set by brand-desktop.mjs).
 *
 * Windows and Linux: Bitwarden's own afterPack (Electron fuses, Linux memory-protection
 * wrapper). macOS: Bitwarden's signs with Bitwarden's Apple identity and copies their Xcode-built
 * autofill extension, neither of which Multiwarden has, so only the same Electron fuses are set
 * here and electron-builder signs the bundle ad hoc.
 */
const path = require("path");

const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const builder = require("electron-builder");

const bitwardenAfterPack = require("../../apps/desktop/scripts/after-pack.js").default;

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return bitwardenAfterPack(context);
  }

  // A universal build calls afterPack for x64, arm64 and then universal; only the last is shipped.
  const requested = context.packager.info.options.targets?.get(context.packager.platform);
  if (requested?.has(builder.Arch.universal) && context.arch !== builder.Arch.universal) {
    return;
  }

  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log("## Multiwarden: adding fuses to", app);
  // The same fuses as Bitwarden's after-pack.js (addElectronFuses).
  await flipFuses(app, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    resetAdHocDarwinSignature: context.arch === builder.Arch.universal,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    [FuseV1Options.WasmTrapHandlers]: true,
  });
};
