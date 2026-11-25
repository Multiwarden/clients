import { app, BrowserWindow, dialog, net, Notification } from "electron";
import type { AppUpdater } from "electron-updater";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UrlType } from "@bitwarden/common/platform/misc/safe-urls";
import { LogService } from "@bitwarden/logging";

import { SafeShell } from "../../platform/main/safe-shell.main";
import { multiwardenVersion } from "../multiwarden-version";

/**
 * Multiwarden: updates of the desktop app come from Multiwarden's GitHub releases, never from
 * Bitwarden's update feed (which would replace Multiwarden with Bitwarden).
 *
 * - The Windows installer and the Linux AppImage update themselves, like Bitwarden's app.
 * - macOS (unsigned, so it cannot install updates), the .deb package and the portable Windows
 *   app say when a new version is out and open the downloads page.
 *
 * The app keeps Bitwarden's version (Bitwarden's servers decide some features by it), so every
 * Multiwarden release of one Bitwarden version has the same app version. The update files
 * (latest.yml, latest-linux.yml, latest-mac.yml) therefore carry the Multiwarden version in a
 * form electron-updater can compare: see {@link toUpdaterVersion}.
 */

/** Where the update files of the newest release are; GitHub redirects to that release. */
export const MULTIWARDEN_UPDATE_FEED =
  "https://github.com/multiwarden/clients/releases/latest/download";

/** Downloads page that the platforms without self-update are sent to. */
export const MULTIWARDEN_DOWNLOAD_URL = "https://multiwarden.com/download";

/**
 * The Multiwarden version 2026.11.0.5 as a semantic version for the update files: the patch
 * number holds both Bitwarden's patch and Multiwarden's release, as patch * 1000 + release
 * (2026.11.5). multiwarden/scripts/desktop-update-info.mjs writes it the same way.
 */
export function toUpdaterVersion(version: string): string {
  const [year, month, patch, release] = version.split(".").map((part) => parseInt(part, 10));
  return `${year}.${month}.${(patch || 0) * 1000 + (release || 0)}`;
}

/** The Multiwarden version that {@link toUpdaterVersion} turned into the given version. */
export function fromUpdaterVersion(version: string): string {
  const [year, month, combined] = version.split(".").map((part) => parseInt(part, 10));
  return `${year}.${month}.${Math.floor(combined / 1000)}.${combined % 1000}`;
}

/** Whether Multiwarden version `a` is newer than `b`. */
export function isNewerVersion(a: string, b: string): boolean {
  const left = a.split(".").map((part) => parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }
  return false;
}

/** The Multiwarden version that is running, for example 2026.11.0.5. */
export function currentMultiwardenVersion(): string {
  return multiwardenVersion(app.getVersion());
}

/**
 * Points electron-updater at Multiwarden's releases, for the Windows installer and the AppImage.
 */
export function multiwardenUseOwnUpdateFeed(updater: AppUpdater): void {
  updater.setFeedURL({ provider: "generic", url: MULTIWARDEN_UPDATE_FEED });
  // The previous version's block map has another name on another release; download in full.
  updater.disableDifferentialDownload = true;
  // Only a newer Multiwarden release is an update (see toUpdaterVersion).
  updater.isUpdateSupported = (info) =>
    isNewerVersion(fromUpdaterVersion(info.version), currentMultiwardenVersion());
}

/** The update file that electron-builder writes for this platform. */
function updateFileName(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "latest-mac.yml";
    case "linux":
      return "latest-linux.yml";
    default:
      return "latest.yml";
  }
}

/** Reads the Multiwarden version out of an update file, or `null` when it has none. */
export function versionFromUpdateFile(contents: string): string | null {
  const match = /^version:\s*['"]?([0-9.]+)['"]?\s*$/m.exec(contents);
  return match == null ? null : fromUpdaterVersion(match[1]);
}

/**
 * Tells about new versions on the platforms that cannot update themselves, and opens the
 * downloads page.
 */
export class MultiwardenUpdateNotifier {
  private notifiedVersion: string | null = null;
  // Kept so the notification is not garbage collected, which would break its click handler.
  private notification: Notification | null = null;

  constructor(
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
    private readonly shell: SafeShell,
    private readonly window: () => BrowserWindow | null,
  ) {}

  /**
   * Looks for a newer release. With `withFeedback` (the user chose "Check for updates") the
   * answer is always shown in a dialog; otherwise a new version is announced once, in a system
   * notification.
   */
  async check(withFeedback: boolean): Promise<void> {
    let latest: string | null;
    try {
      const response = await net.fetch(
        `${MULTIWARDEN_UPDATE_FEED}/${updateFileName(process.platform)}`,
      );
      latest = response.ok ? versionFromUpdateFile(await response.text()) : null;
    } catch (error) {
      this.logService.warning("Multiwarden update check failed", error);
      latest = null;
    }

    const win = this.window();
    if (latest == null || !isNewerVersion(latest, currentMultiwardenVersion())) {
      if (withFeedback && win != null) {
        if (latest == null) {
          // Could not tell: let the user look for themselves.
          this.openDownloadPage();
          return;
        }
        await dialog.showMessageBox(win, {
          message: this.i18nService.t("noUpdatesAvailable"),
          buttons: [this.i18nService.t("ok")],
          defaultId: 0,
          noLink: true,
        });
      }
      return;
    }

    if (withFeedback && win != null) {
      await this.askToDownload(win, latest);
      return;
    }
    if (this.notifiedVersion === latest) {
      return;
    }
    this.notifiedVersion = latest;
    if (!Notification.isSupported()) {
      if (win != null) {
        await this.askToDownload(win, latest);
      }
      return;
    }
    this.notification?.close();
    this.notification = new Notification({
      title: `${this.i18nService.t("bitwarden")} - ${this.i18nService.t("updateAvailable")}`,
      body: `${this.i18nService.t("bitwarden")} ${latest}`,
      timeoutType: "never",
      silent: false,
    });
    this.notification.on("click", () => this.openDownloadPage());
    this.notification.show();
  }

  private async askToDownload(win: BrowserWindow, latest: string): Promise<void> {
    const result = await dialog.showMessageBox(win, {
      type: "info",
      title: `${this.i18nService.t("bitwarden")} - ${this.i18nService.t("updateAvailable")}`,
      message: this.i18nService.t("updateAvailable"),
      detail: `${this.i18nService.t("bitwarden")} ${latest}`,
      buttons: [this.i18nService.t("download"), this.i18nService.t("later")],
      cancelId: 1,
      defaultId: 0,
      noLink: true,
    });
    if (result.response === 0) {
      this.openDownloadPage();
    }
  }

  private openDownloadPage(): void {
    this.shell.openExternal(MULTIWARDEN_DOWNLOAD_URL, UrlType.WebUrl);
  }
}
