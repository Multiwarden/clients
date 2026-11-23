// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, inject, input } from "@angular/core";
import { Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

import { MultiwardenCombinedService } from "@bitwarden/angular/multiwarden";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AccountSwitcherEntries,
  AccountSwitcherService,
} from "@bitwarden/common/auth/account-switcher";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import {
  AvatarModule,
  IconButtonModule,
  MenuModule,
  MenuPositionIdentifier,
  IconComponent,
  BadgeComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopBiometricsService } from "../../../key-management/biometrics/desktop.biometrics.service";

type SwitcherView = AccountSwitcherEntries & { showSwitcher: boolean };

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-account-switcher-v2",
  templateUrl: "account-switcher-v2.component.html",
  imports: [
    CommonModule,
    MenuModule,
    I18nPipe,
    AvatarModule,
    IconButtonModule,
    IconComponent,
    BadgeComponent,
  ],
})
export class AccountSwitcherV2Component {
  /** Whether the side nav is expanded. Controls whether the name and email are shown. */
  readonly expanded = input<boolean>(false);

  /** Preferred opening position of the switcher menu, relative to the trigger. */
  readonly menuPosition = input<MenuPositionIdentifier>("below-end");

  authStatus = AuthenticationStatus;

  view$: Observable<SwitcherView>;

  disabled = false;

  // Multiwarden: the "Combined" entry, offered while more than one account is unlocked.
  protected readonly multiwardenCombined = inject(MultiwardenCombinedService);
  protected readonly multiwardenCombinedEntry$ = combineLatest([
    this.multiwardenCombined.accounts$,
    this.multiwardenCombined.enabled$,
  ]).pipe(map(([accounts, on]) => ({ show: accounts.filter((a) => a.unlocked).length > 1, on })));

  constructor(
    private messagingService: MessagingService,
    private messageListener: MessageListener,
    private router: Router,
    private accountService: AccountService,
    private biometricsService: DesktopBiometricsService,
    private accountSwitcherService: AccountSwitcherService,
  ) {
    this.view$ = this.accountSwitcherService.entries$.pipe(
      map((entries) => ({
        ...entries,
        showSwitcher: entries.active != null || entries.inactive.length > 0,
      })),
    );
  }

  async switch(userId: string) {
    // Multiwarden: choosing a single account leaves combined mode.
    await this.multiwardenCombined.setCombined(false);
    await this.biometricsService.setShouldAutopromptNow(true);

    this.disabled = true;
    const accountSwitchFinishedPromise = firstValueFrom(
      this.messageListener.messages$(new CommandDefinition("finishSwitchAccount")),
    );
    this.messagingService.send("switchAccount", { userId });
    await accountSwitchFinishedPromise;
    this.disabled = false;
  }

  async addAccount() {
    await this.accountService.switchAccount(null);
    await this.router.navigate(["/login"]);
  }
}
