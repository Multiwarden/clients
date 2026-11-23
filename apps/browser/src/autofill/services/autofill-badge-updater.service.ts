import { combineLatest, distinctUntilChanged, mergeMap, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { getMultiAccountScope } from "@bitwarden/common/multiwarden/multi-account-scope";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { Tab } from "../../platform/badge/badge-browser-api";
import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";

import { CipherUse, FillCipherPolicy } from "./abstractions/fill-cipher-policy";

const StateName = "autofill-badge-updater";

export class AutofillBadgeUpdaterService {
  constructor(
    private badgeService: BadgeService,
    private accountService: AccountService,
    private fillCipherPolicy: FillCipherPolicy,
    private badgeSettingsService: BadgeSettingsServiceAbstraction,
    private logService: LogService,
  ) {}

  init() {
    const ciphersChanged$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account?.id ? this.fillCipherPolicy.changed$(account.id) : of(undefined),
      ),
    );

    this.badgeService.setState(StateName, (tab) => {
      return combineLatest({
        account: this.accountService.activeAccount$,
        enableBadgeCounter:
          this.badgeSettingsService.enableBadgeCounter$.pipe(distinctUntilChanged()),
        ciphersChanged: ciphersChanged$,
      }).pipe(
        mergeMap(async ({ account, enableBadgeCounter }) => {
          if (!account || !enableBadgeCounter) {
            return undefined;
          }

          return {
            state: {
              text: await this.calculateCountText(tab, account.id),
            },
            priority: BadgeStatePriority.Default,
          };
        }),
      );
    });
  }

  private async calculateCountText(tab: Tab, userId: UserId) {
    if (!tab.tabId) {
      this.logService.warning("Tab event received but tab id is undefined");
      return;
    }

    const url = tab.url;
    // Multiwarden: count matching logins in every unlocked account, each shared login once.
    const scope = getMultiAccountScope();
    const ciphers = !url
      ? []
      : scope
        ? await scope.collectItems((id) =>
            this.fillCipherPolicy.ciphersForUrl(url, id, CipherUse.Badge),
          )
        : await this.fillCipherPolicy.ciphersForUrl(url, userId, CipherUse.Badge);
    const cipherCount = new Set(ciphers.map((c) => c.id)).size;

    if (cipherCount === 0) {
      return undefined;
    }

    return cipherCount > 9 ? "9+" : cipherCount.toString();
  }
}
