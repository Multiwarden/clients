import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { UserId } from "@bitwarden/common/types/guid";

import BrowserLocalStorageService from "../../platform/services/browser-local-storage.service";

/**
 * Multiwarden: remembers which account was last used to save a login or passkey for a site, so
 * the account picker can default to it next time. Works in both the background and the popup.
 *
 * Site keys are stored as SHA-256 hashes, so local storage does not hold a readable list of
 * the sites you use.
 */
const STORAGE_KEY = "multiwarden_lastAccountBySite";
const MAX_ENTRIES = 1000;

type LastAccountMap = Record<string, { userId: UserId; at: number }>;

let storage: BrowserLocalStorageService | undefined;
function localStore(): BrowserLocalStorageService {
  storage ??= new BrowserLocalStorageService(new ConsoleLogService(false));
  return storage;
}

async function hashSite(site: string): Promise<string> {
  const bytes = new TextEncoder().encode(site.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function readMap(): Promise<LastAccountMap> {
  try {
    return (await localStore().get<LastAccountMap>(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

export async function getLastAccountForSite(
  site: string | null | undefined,
): Promise<UserId | undefined> {
  if (!site) {
    return undefined;
  }
  const map = await readMap();
  return map[await hashSite(site)]?.userId;
}

export async function setLastAccountForSite(
  site: string | null | undefined,
  userId: UserId,
): Promise<void> {
  if (!site) {
    return;
  }
  try {
    const map = await readMap();
    map[await hashSite(site)] = { userId, at: Date.now() };
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].at - a[1].at);
      await localStore().save(STORAGE_KEY, Object.fromEntries(entries.slice(0, MAX_ENTRIES)));
      return;
    }
    await localStore().save(STORAGE_KEY, map);
  } catch {
    // Remembering the account is a convenience; never block a save on it.
  }
}

/** Removes a signed-out account from the memory, so it is never offered as a default. */
export async function forgetAccount(userId: UserId): Promise<void> {
  try {
    const map = await readMap();
    for (const [key, value] of Object.entries(map)) {
      if (value.userId === userId) {
        delete map[key];
      }
    }
    await localStore().save(STORAGE_KEY, map);
  } catch {
    // ignore
  }
}
