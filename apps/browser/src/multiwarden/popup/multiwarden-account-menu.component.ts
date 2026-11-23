import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import { MultiwardenAccount, MultiwardenCombinedService } from "@bitwarden/angular/multiwarden";
import { AvatarModule, IconModule, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccountSwitcherService } from "../../auth/popup/account-switching/services/account-switcher.service";

/**
 * Multiwarden: the avatar in the top-right corner, as a dropdown. Switch between "Combined"
 * (every unlocked account at once) and single accounts without leaving the page, or open the
 * full account page.
 */
@Component({
  selector: "app-multiwarden-account-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule, IconModule, MenuModule, I18nPipe],
  templateUrl: "multiwarden-account-menu.component.html",
})
export class MultiwardenAccountMenuComponent {
  private readonly combined = inject(MultiwardenCombinedService);
  private readonly accountSwitcherService = inject(AccountSwitcherService);
  private readonly router = inject(Router);

  /** Avatar size, following the page header (upstream: "sm" with VFO1, else "base"). */
  readonly size = input<"sm" | "base">("base");
  /** The full account page was asked for. */
  readonly manage = output<void>();

  protected readonly accounts = toSignal(this.combined.accounts$, { initialValue: [] });
  protected readonly combinedOn = toSignal(this.combined.enabled$, { initialValue: false });

  protected activeAccount(): MultiwardenAccount | undefined {
    return this.accounts().find((a) => a.active);
  }

  /** The first two unlocked accounts, drawn overlapping as the "Combined" avatar. */
  protected combinedAvatars(): MultiwardenAccount[] {
    return this.accounts()
      .filter((a) => a.unlocked)
      .slice(0, 2);
  }

  protected async chooseCombined() {
    await this.combined.setCombined(true);
    await this.router.navigate(["/tabs/vault"]);
  }

  protected async chooseAccount(account: MultiwardenAccount) {
    await this.combined.setCombined(false);
    if (!account.active || !account.unlocked) {
      await this.accountSwitcherService.selectAccount(account.userId);
    }
  }
}
