import { Observable, distinctUntilChanged, map, shareReplay, startWith, switchMap } from "rxjs";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import { BrowserApi } from "../platform/browser/browser-api";
import BrowserLocalStorageService from "../platform/services/browser-local-storage.service";

/**
 * Multiwarden: settings that only exist in Multiwarden. Stored in the extension's local storage,
 * shared by the background and the popup, and the same for every account.
 */
export type MultiwardenSettings = {
  /** The popup shows every unlocked account's items together (chosen in the account menu). */
  combinedMode: boolean;
  /** Hide Premium upgrade callouts, spotlights and badges. */
  hidePremiumNotices: boolean;
  /** Pre-select the account last used on a site in the save-password prompt. */
  rememberSaveAccountPerSite: boolean;
  /** Which account autofill on page load may use when several are unlocked. */
  pageLoadAutofillAccount: PageLoadAutofillAccount;
};

/**
 * - remembered: the account last used on the site; if none, as "unique".
 * - unique: only when exactly one login across all unlocked accounts matches.
 * - active: only the active account (Bitwarden's behaviour).
 */
export const PageLoadAutofillAccount = Object.freeze({
  Remembered: "remembered",
  Unique: "unique",
  Active: "active",
} as const);
export type PageLoadAutofillAccount =
  (typeof PageLoadAutofillAccount)[keyof typeof PageLoadAutofillAccount];

export const DEFAULT_MULTIWARDEN_SETTINGS: MultiwardenSettings = Object.freeze({
  combinedMode: false,
  hidePremiumNotices: false,
  rememberSaveAccountPerSite: true,
  pageLoadAutofillAccount: PageLoadAutofillAccount.Remembered,
});

const STORAGE_KEY = "multiwarden_settings";

let storage: BrowserLocalStorageService | undefined;
function localStore(): BrowserLocalStorageService {
  storage ??= new BrowserLocalStorageService(new ConsoleLogService(false));
  return storage;
}

export async function getMultiwardenSettings(): Promise<MultiwardenSettings> {
  try {
    const stored = await localStore().get<Partial<MultiwardenSettings>>(STORAGE_KEY);
    return { ...DEFAULT_MULTIWARDEN_SETTINGS, ...(stored ?? {}) };
  } catch {
    return { ...DEFAULT_MULTIWARDEN_SETTINGS };
  }
}

export async function updateMultiwardenSettings(
  changes: Partial<MultiwardenSettings>,
): Promise<MultiwardenSettings> {
  const next = { ...(await getMultiwardenSettings()), ...changes };
  await localStore().save(STORAGE_KEY, next);
  return next;
}

/** Emits the current settings, and again whenever they change in any extension context. */
export const multiwardenSettings$: Observable<MultiwardenSettings> = new Observable<void>(
  (subscriber) => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "local" && STORAGE_KEY in changes) {
        subscriber.next();
      }
    };
    BrowserApi.storageChangeListener(listener);
    return () => BrowserApi.removeListener(chrome.storage.onChanged, listener);
  },
).pipe(
  startWith(undefined),
  switchMap(() => getMultiwardenSettings()),
  shareReplay({ bufferSize: 1, refCount: true }),
);

export function multiwardenSetting$<K extends keyof MultiwardenSettings>(
  key: K,
): Observable<MultiwardenSettings[K]> {
  return multiwardenSettings$.pipe(
    map((settings) => settings[key]),
    distinctUntilChanged(),
  );
}
