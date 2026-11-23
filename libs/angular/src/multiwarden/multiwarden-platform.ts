import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

/**
 * Multiwarden: what each client (browser extension, desktop, ...) supplies so the shared
 * combined-mode code can run there.
 */
export abstract class MultiwardenPlatform {
  /** Whether the user chose the combined view of every unlocked account. */
  abstract readonly combinedMode$: Observable<boolean>;

  /** Stores the combined-view choice. */
  abstract setCombinedMode(on: boolean): Promise<void>;

  /**
   * Asks the client to make an unlocked account the active one, without a full account switch
   * (no sync, no navigation). The shared service waits for the switch to show up.
   */
  abstract requestActivation(userId: UserId): void;
}
