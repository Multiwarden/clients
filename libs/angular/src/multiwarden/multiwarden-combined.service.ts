import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";
import {
  ObservedValueOf,
  Observable,
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  of,
  shareReplay,
  switchMap,
  timeout,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  getMultiAccountScope,
  MultiAccountScope,
  registerMultiAccountScope,
} from "@bitwarden/common/multiwarden/multi-account-scope";
import { UserId } from "@bitwarden/common/types/guid";

import { MultiwardenPlatform } from "./multiwarden-platform";

type AccountsSnapshot = [
  ObservedValueOf<AccountService["accounts$"]>,
  ObservedValueOf<AuthService["authStatuses$"]>,
  ObservedValueOf<AccountService["activeAccount$"]>,
];

/** A signed-in account, as Multiwarden shows it (avatar, email, lock state). */
export type MultiwardenAccount = {
  userId: UserId;
  email: string;
  name: string;
  avatarColor: string | null;
  unlocked: boolean;
  active: boolean;
};

/**
 * Multiwarden: combined mode, shared by the clients (see MultiwardenPlatform for what each
 * client supplies).
 *
 * In combined mode the vault shows every unlocked account's items at once. Bitwarden's own pages
 * and menus still work on "the active account", so before acting on an item Multiwarden quietly
 * makes that item's account active (no sync, no navigation). Combined mode itself stays on until
 * a single account is chosen in the account menu.
 */
@Injectable({ providedIn: "root" })
export class MultiwardenCombinedService {
  // Optional so that upstream component tests, which render pages with only the services those
  // pages need, still work; without them combined mode is simply off.
  private readonly accountService = inject(AccountService, { optional: true });
  private readonly authService = inject(AuthService, { optional: true });
  private readonly avatarService = inject(AvatarService, { optional: true });
  private readonly platform = inject(MultiwardenPlatform, { optional: true });
  private readonly available =
    this.accountService != null &&
    this.authService != null &&
    this.avatarService != null &&
    this.platform != null;

  readonly scope: MultiAccountScope | undefined;

  /** Every signed-in account, in the account switcher's order. */
  private readonly snapshot$: Observable<AccountsSnapshot> = this.available
    ? combineLatest([
        this.accountService!.accounts$,
        this.authService!.authStatuses$,
        this.accountService!.activeAccount$,
      ])
    : of<AccountsSnapshot>([{}, {}, null]);

  readonly accounts$: Observable<MultiwardenAccount[]> = this.snapshot$.pipe(
    switchMap(async ([accounts, statuses, active]) =>
      Promise.all(
        Object.entries(accounts ?? {})
          .filter(([id]) => statuses?.[id as UserId] !== AuthenticationStatus.LoggedOut)
          .map(async ([id, info]): Promise<MultiwardenAccount> => {
            const userId = id as UserId;
            return {
              userId,
              email: info?.email ?? "",
              name: info?.name || info?.email || "",
              avatarColor: await firstValueFrom(this.avatarService!.getUserAvatarColor$(userId)),
              unlocked: statuses?.[userId] === AuthenticationStatus.Unlocked,
              active: active?.id === userId,
            };
          }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Combined mode is on, and there is more than one signed-in account to combine. */
  readonly enabled$: Observable<boolean> = this.available
    ? combineLatest([this.platform!.combinedMode$, this.accountService!.accounts$]).pipe(
        map(([combined, accounts]) => combined && Object.keys(accounts ?? {}).length > 1),
        distinctUntilChanged(),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
    : of(false);

  /**
   * The accounts whose items the vault shows: every unlocked account in combined mode,
   * otherwise only the active one. The order doesn't follow the active account, so quietly
   * activating an item's account doesn't reload the list.
   */
  readonly userIds$: Observable<UserId[]> = this.enabled$.pipe(
    switchMap((enabled) =>
      enabled
        ? this.accounts$.pipe(
            map((accounts) => accounts.filter((a) => a.unlocked).map((a) => a.userId)),
          )
        : (this.accountService?.activeAccount$ ?? of(null)).pipe(
            map((account) => (account?.id ? [account.id] : [])),
          ),
    ),
    distinctUntilChanged((a, b) => a.length === b.length && a.every((id, i) => id === b[i])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    if (!this.available) {
      return;
    }
    this.scope =
      getMultiAccountScope() ?? new MultiAccountScope(this.accountService!, this.authService!);
    registerMultiAccountScope(this.scope);
    this.trackRowInteractions(inject(DOCUMENT));
  }

  /**
   * Bitwarden's row actions (fill, copy, menus) act on the active account. Pressing or focusing
   * anything inside a row whose badge names a cipher makes that cipher's account active first.
   */
  private trackRowInteractions(doc: Document) {
    const handler = (event: Event) => {
      const cipherId = cipherIdForEvent(event);
      if (cipherId) {
        void this.prepareFor(cipherId);
      }
    };
    doc.addEventListener("pointerdown", handler, { capture: true });
    doc.addEventListener("focusin", handler, { capture: true });
  }

  /** Merges per-account lists, active account first, keeping one copy of items shared by both. */
  mergeForUsers<T extends { id?: unknown }>(
    load: (userId: UserId) => Observable<T[]>,
  ): Observable<T[]> {
    return this.userIds$.pipe(
      switchMap((userIds) => {
        if (userIds.length === 0) {
          return of<T[]>([]);
        }
        return combineLatest(
          userIds.map((userId) =>
            load(userId).pipe(
              map((items) => {
                for (const item of items ?? []) {
                  const id = idOf(item);
                  if (id && this.scope?.ownerOf(id) == null) {
                    this.scope?.remember(id, userId);
                  }
                }
                return items ?? [];
              }),
            ),
          ),
        ).pipe(
          map((lists) => {
            const seen = new Set<string>();
            const merged: T[] = [];
            for (const item of lists.flat()) {
              const id = idOf(item);
              if (id) {
                if (seen.has(id)) {
                  continue;
                }
                seen.add(id);
              }
              merged.push(item);
            }
            return merged;
          }),
        );
      }),
    );
  }

  /** The account an item belongs to, as shown on its badge. */
  accountFor$(cipherId: string | null | undefined): Observable<MultiwardenAccount | undefined> {
    return combineLatest([this.enabled$, this.accounts$]).pipe(
      map(([enabled, accounts]) => {
        if (!enabled) {
          return undefined;
        }
        const owner = this.scope?.ownerOf(cipherId);
        return accounts.find((a) => a.userId === owner);
      }),
    );
  }

  /** Turns combined mode on or off. Turning it on makes sure an unlocked account is active. */
  async setCombined(on: boolean): Promise<void> {
    if (!this.available) {
      return;
    }
    await this.platform!.setCombinedMode(on);
    if (on) {
      const accounts = await firstValueFrom(this.accounts$);
      const active = accounts.find((a) => a.active);
      if (!active?.unlocked) {
        const firstUnlocked = accounts.find((a) => a.unlocked);
        if (firstUnlocked) {
          await this.activate(firstUnlocked.userId);
        }
      }
    }
  }

  /** Quietly makes `userId` the active account, if it isn't already. */
  async activate(userId: UserId | null | undefined): Promise<void> {
    if (userId == null || !this.available) {
      return;
    }
    const active = await firstValueFrom(this.accountService!.activeAccount$);
    if (active?.id === userId) {
      return;
    }
    const switched = firstValueFrom(
      this.accountService!.activeAccount$.pipe(
        filter((account) => account?.id === userId),
        timeout({ first: 3000, with: () => of(null) }),
      ),
    );
    this.platform!.requestActivation(userId);
    await switched;
  }

  /** In combined mode, makes the item's account active before something acts on it. */
  async prepareFor(cipherId: string | null | undefined): Promise<void> {
    if (!(await firstValueFrom(this.enabled$))) {
      return;
    }
    await this.activate(this.scope?.ownerOf(cipherId));
  }
}

function idOf(item: { id?: unknown }): string | undefined {
  return item.id == null ? undefined : String(item.id);
}

const BADGE_SELECTOR = "[data-multiwarden-cipher]";

/** The cipher of the row an event happened in: the nearest ancestor holding exactly one badge. */
function cipherIdForEvent(event: Event): string | undefined {
  let node = event.target instanceof Element ? event.target : null;
  while (node && node !== node.ownerDocument.body) {
    const badges = node.querySelectorAll(BADGE_SELECTOR);
    if (badges.length > 1) {
      return undefined;
    }
    if (badges.length === 1) {
      return badges[0].getAttribute("data-multiwarden-cipher") ?? undefined;
    }
    node = node.parentElement;
  }
  return undefined;
}
