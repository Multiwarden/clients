import { combineLatest, firstValueFrom, map, Observable, of } from "rxjs";

import { AccountService } from "../auth/abstractions/account.service";
import { AuthService } from "../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../auth/enums/authentication-status";
import { UserId } from "../types/guid";

/**
 * Multiwarden: a user that is logged in and unlocked, and so can be read and written to
 * without switching the active account.
 */
export interface UnlockedAccount {
  userId: UserId;
  email: string;
  name?: string;
  isActive: boolean;
}

/**
 * Multiwarden: the one place that answers "which accounts can this feature use right now?"
 * and "which account owns this cipher?".
 *
 * Upstream Bitwarden scopes autofill, save prompts and passkeys to the active account. Multiwarden
 * keeps every unlocked account in scope at once. Features ask this class for the list of unlocked
 * accounts (active account first), and record which account a cipher came from so that later
 * writes (last-used date, password update, passkey counter) go to the right vault.
 *
 * Cipher ids are server-issued GUIDs, so one map across accounts is safe.
 */
export class MultiAccountScope {
  private readonly owners = new Map<string, UserId>();

  /** Optional source of each account's chosen avatar colour (set by the client). */
  avatarColorFor: (userId: UserId) => Observable<string | null> = () => of(null);

  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
  ) {}

  /** Every unlocked account, active account first, then in the account switcher's order. */
  readonly unlockedAccounts$: Observable<UnlockedAccount[]> = combineLatest([
    this.accountService.accounts$,
    this.accountService.activeAccount$,
    this.authService.authStatuses$,
  ]).pipe(
    map(([accounts, active, statuses]) => {
      const result: UnlockedAccount[] = [];
      for (const [id, info] of Object.entries(accounts ?? {})) {
        const userId = id as UserId;
        if (statuses?.[userId] !== AuthenticationStatus.Unlocked) {
          continue;
        }
        result.push({
          userId,
          email: info?.email ?? "",
          name: info?.name ?? undefined,
          isActive: active?.id === userId,
        });
      }
      return result.sort((a, b) => Number(b.isActive) - Number(a.isActive));
    }),
  );

  async unlockedAccounts(): Promise<UnlockedAccount[]> {
    return await firstValueFrom(this.unlockedAccounts$);
  }

  async unlockedUserIds(): Promise<UserId[]> {
    return (await this.unlockedAccounts()).map((a) => a.userId);
  }

  async isUnlocked(userId: UserId | null | undefined): Promise<boolean> {
    if (userId == null) {
      return false;
    }
    return (await this.unlockedUserIds()).includes(userId);
  }

  /** True when more than one account is unlocked, so the UI should show which account is which. */
  async hasMultipleUnlocked(): Promise<boolean> {
    return (await this.unlockedUserIds()).length > 1;
  }

  /** Records that `cipherId` belongs to `userId`. */
  remember(cipherId: string | null | undefined, userId: UserId): void {
    if (cipherId) {
      this.owners.set(cipherId, userId);
    }
  }

  /** The account a cipher was loaded from, if this scope has seen it. */
  ownerOf(cipherId: string | null | undefined): UserId | undefined {
    return cipherId ? this.owners.get(cipherId) : undefined;
  }

  /**
   * Runs `load` for every unlocked account and concatenates the results, remembering which
   * account each item came from. Items from the active account come first. A failure in one
   * account (for example a vault that is still decrypting) does not hide the others.
   */
  async collect<T extends { id?: string | null }>(
    load: (userId: UserId) => Promise<T[]>,
  ): Promise<{ item: T; userId: UserId }[]> {
    const userIds = await this.unlockedUserIds();
    const perAccount = await Promise.all(
      userIds.map(async (userId) => {
        try {
          return { userId, items: (await load(userId)) ?? [] };
        } catch {
          return { userId, items: [] as T[] };
        }
      }),
    );
    const result: { item: T; userId: UserId }[] = [];
    for (const { userId, items } of perAccount) {
      for (const item of items) {
        this.remember(item.id, userId);
        result.push({ item, userId });
      }
    }
    return result;
  }

  /** Like `collect`, but returns the items only. */
  async collectItems<T extends { id?: string | null }>(
    load: (userId: UserId) => Promise<T[]>,
  ): Promise<T[]> {
    return (await this.collect(load)).map((r) => r.item);
  }

  /**
   * Finds the owner of a cipher: the remembered owner if it is still unlocked, otherwise the
   * first unlocked account for which `has` answers true. Falls back to the active account.
   */
  async resolveOwner(
    cipherId: string | null | undefined,
    has: (userId: UserId) => Promise<boolean>,
  ): Promise<UserId | undefined> {
    const unlocked = await this.unlockedUserIds();
    const known = this.ownerOf(cipherId);
    if (known && unlocked.includes(known)) {
      return known;
    }
    for (const userId of unlocked) {
      try {
        if (await has(userId)) {
          this.remember(cipherId, userId);
          return userId;
        }
      } catch {
        // try the next account
      }
    }
    return unlocked[0];
  }

  /** A short label for an account, used next to item names: the email address. */
  async labelFor(userId: UserId | null | undefined): Promise<string | undefined> {
    if (userId == null) {
      return undefined;
    }
    const accounts = await firstValueFrom(this.accountService.accounts$);
    return accounts?.[userId]?.email ?? undefined;
  }
}

let registeredScope: MultiAccountScope | undefined;

/**
 * Multiwarden: registers the scope for this JavaScript context (the background service worker).
 * Services that are shared with upstream code read it through `getMultiAccountScope()` so that
 * their constructors, and upstream's tests, stay unchanged.
 */
export function registerMultiAccountScope(scope: MultiAccountScope | undefined): void {
  registeredScope = scope;
}

/** Multiwarden: the scope registered for this context, if any. */
export function getMultiAccountScope(): MultiAccountScope | undefined {
  return registeredScope;
}
