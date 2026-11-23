import { Injectable, inject } from "@angular/core";
import { Observable, distinctUntilChanged, map, of, shareReplay } from "rxjs";

import {
  DESKTOP_SETTINGS_DISK,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

/**
 * Multiwarden: settings that only exist in Multiwarden, the same for every account.
 *
 * They are kept in the renderer's ordinary state storage, not in the Electron main process, so
 * nothing here depends on the desktop runtime.
 */
export type MultiwardenDesktopSettings = {
  /** The vault shows every unlocked account's items together (chosen in the account menu). */
  combinedMode: boolean;
  /** Hide Premium upgrade callouts, spotlights and badges. */
  hidePremiumNotices: boolean;
};

export const DEFAULT_MULTIWARDEN_DESKTOP_SETTINGS: MultiwardenDesktopSettings = Object.freeze({
  combinedMode: false,
  hidePremiumNotices: false,
});

const MULTIWARDEN_SETTINGS = new KeyDefinition<Partial<MultiwardenDesktopSettings>>(
  DESKTOP_SETTINGS_DISK,
  "multiwardenSettings",
  { deserializer: (settings) => settings },
);

@Injectable({ providedIn: "root" })
export class MultiwardenSettingsService {
  // Optional so that upstream component tests, which provide only what their page needs, still
  // work; without state the defaults apply.
  private readonly state = inject(StateProvider, { optional: true })?.getGlobal(
    MULTIWARDEN_SETTINGS,
  );

  readonly settings$: Observable<MultiwardenDesktopSettings> = (
    this.state?.state$ ?? of(null)
  ).pipe(
    map((stored) => ({ ...DEFAULT_MULTIWARDEN_DESKTOP_SETTINGS, ...(stored ?? {}) })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  setting$<K extends keyof MultiwardenDesktopSettings>(
    key: K,
  ): Observable<MultiwardenDesktopSettings[K]> {
    return this.settings$.pipe(
      map((settings) => settings[key]),
      distinctUntilChanged(),
    );
  }

  async update(changes: Partial<MultiwardenDesktopSettings>): Promise<void> {
    await this.state?.update((stored) => ({ ...(stored ?? {}), ...changes }));
  }
}
