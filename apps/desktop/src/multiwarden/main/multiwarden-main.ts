import { app } from "electron";

/**
 * Multiwarden: the few Electron main-process differences from Bitwarden's desktop app. Kept in
 * one file so that a later move to another desktop runtime (Tauri is planned) has a single
 * list of what to carry over.
 */

/** GitHub releases of Multiwarden; "Check for updates" opens it. */
export const MULTIWARDEN_RELEASES_URL = "https://github.com/multiwarden/clients/releases";

/**
 * Multiwarden does not update itself: Bitwarden's update feed would replace it with Bitwarden.
 * "Check for updates" opens the releases page instead.
 */
export const MULTIWARDEN_AUTO_UPDATE = false;

/**
 * Bitwarden's web pages send some sign-in steps back through `bitwarden://` links (Duo, SSO
 * cookies, LastPass import). Only one app can receive them, so Multiwarden takes the link only
 * when no other app (Bitwarden) has it. Returns whether Multiwarden may (re)register it.
 */
export function multiwardenMayHandleBitwardenLinks(): boolean {
  if (app.isDefaultProtocolClient("bitwarden")) {
    return true;
  }
  const handler = app.getApplicationNameForProtocol("bitwarden://");
  return handler === "" || handler === app.getName();
}

/**
 * Multiwarden: browser integration ("Allow browser integration") uses its own native messaging
 * host, so installing Multiwarden never replaces the manifests Bitwarden's desktop app writes
 * for Bitwarden's extension. The Multiwarden extension connects to this host name
 * (apps/browser/src/multiwarden/multiwarden-native-host.ts holds the same name).
 */
export const MULTIWARDEN_NATIVE_HOST = "com.multiwarden.desktop";
export const MULTIWARDEN_NATIVE_MANIFEST = `${MULTIWARDEN_NATIVE_HOST}.json`;

/**
 * Chromium origins allowed to talk to the desktop app: the Multiwarden extension from GitHub
 * releases (fixed by multiwarden/branding/extension-key.txt). Add the Chrome Web Store ID here
 * once the store listing has one.
 */
export const MULTIWARDEN_CHROME_ORIGINS = ["chrome-extension://geefkjbbjaipgadampajlkghfamlljll/"];

/** Firefox add-on ID of the Multiwarden extension. */
export const MULTIWARDEN_FIREFOX_IDS = ["multiwarden@mteij.nl"];
