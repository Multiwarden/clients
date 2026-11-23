import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { getMultiAccountScope } from "@bitwarden/common/multiwarden/multi-account-scope";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherUse, FillCipherPolicy } from "../services/abstractions/fill-cipher-policy";
import { AutofillCipherTypeId } from "../types";

import { MainContextMenuHandler } from "./main-context-menu-handler";

export class CipherContextMenuHandler {
  /** Multiwarden: cipher id to account email, when several accounts are unlocked. */
  private accountLabels = new Map<string, string>();

  constructor(
    private mainContextMenuHandler: MainContextMenuHandler,
    private authService: AuthService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private fillCipherPolicy: FillCipherPolicy,
  ) {}

  async update(url: string, currentUriIsBlocked: boolean = false) {
    if (this.mainContextMenuHandler.initRunning) {
      return;
    }

    const authStatus = await this.authService.getAuthStatus();
    await MainContextMenuHandler.removeAll();
    if (authStatus !== AuthenticationStatus.Unlocked) {
      // Should I pass in the auth status or even have two separate methods for this
      // on MainContextMenuHandler
      await this.mainContextMenuHandler.noAccess();
      return;
    }

    const menuEnabled = await this.mainContextMenuHandler.init();
    if (!menuEnabled) {
      return;
    }

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId == null) {
      return;
    }

    // Multiwarden: logins, cards and identities from every unlocked account.
    const scope = getMultiAccountScope();
    const load = (userId: UserId) =>
      this.fillCipherPolicy.ciphersForUrl(url, userId, CipherUse.UserFill, {
        includeOtherTypes: [CipherType.Card, CipherType.Identity],
      });
    const ciphers = scope ? await scope.collectItems(load) : await load(activeUserId);
    ciphers.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));
    this.accountLabels = new Map();
    if (scope && (await scope.hasMultipleUnlocked())) {
      for (const cipher of ciphers) {
        const label = await scope.labelFor(scope.ownerOf(cipher.id));
        if (label) {
          this.accountLabels.set(cipher.id, label);
        }
      }
    }

    const groupedCiphers: Record<AutofillCipherTypeId, CipherView[]> = ciphers.reduce(
      (ciphersByType, cipher) => {
        if (!cipher?.type) {
          return ciphersByType;
        }

        const existingCiphersOfType = ciphersByType[cipher.type as AutofillCipherTypeId] || [];

        return {
          ...ciphersByType,
          [cipher.type]: [...existingCiphersOfType, cipher],
        };
      },
      {
        [CipherType.Login]: [],
        [CipherType.Card]: [],
        [CipherType.Identity]: [],
        // SSH keys are not surfaced in the right-click context menu yet, but the grouping
        // record must cover every AutofillCipherTypeId.
        [CipherType.SshKey]: [],
      },
    );

    if (groupedCiphers[CipherType.Login].length === 0) {
      await this.mainContextMenuHandler.noLogins();
    }

    if (groupedCiphers[CipherType.Identity].length === 0) {
      await this.mainContextMenuHandler.noIdentities();
    }

    if (groupedCiphers[CipherType.Card].length === 0) {
      await this.mainContextMenuHandler.noCards();
    }

    for (const cipher of ciphers) {
      await this.updateForCipher(cipher);
    }

    if (currentUriIsBlocked) {
      await this.mainContextMenuHandler.removeBlockedUriMenuItems();
    }
  }

  private async updateForCipher(cipher: CipherView) {
    if (
      cipher == null ||
      !new Set([CipherType.Login, CipherType.Card, CipherType.Identity] as CipherType[]).has(
        cipher.type,
      )
    ) {
      return;
    }

    let title = cipher.name;

    if (cipher.type === CipherType.Login && !Utils.isNullOrEmpty(title) && cipher.login?.username) {
      title += ` (${cipher.login.username})`;
    }

    if (cipher.type === CipherType.Card && cipher.card?.subTitle) {
      title += ` ${cipher.card.subTitle}`;
    }

    // Multiwarden: say which account the item is in when several are unlocked.
    const accountLabel = this.accountLabels.get(cipher.id);
    if (accountLabel) {
      title += ` · ${accountLabel}`;
    }

    await this.mainContextMenuHandler.loadOptions(title, cipher.id, cipher);
  }
}
