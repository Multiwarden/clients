import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { MultiwardenPlatform } from "@bitwarden/angular/multiwarden";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { MultiwardenSettingsService } from "./multiwarden-settings.service";

/**
 * Multiwarden: the desktop app's side of combined mode.
 *
 * Everything happens in the renderer: the choice is a Multiwarden setting and activation is
 * Bitwarden's own account state change, without the "switchAccount" flow (no sync, no
 * navigation). No Electron IPC is involved.
 */
@Injectable()
export class DesktopMultiwardenPlatform extends MultiwardenPlatform {
  private readonly settings = inject(MultiwardenSettingsService);
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);

  readonly combinedMode$ = this.settings.setting$("combinedMode");

  async setCombinedMode(on: boolean): Promise<void> {
    await this.settings.update({ combinedMode: on });
  }

  requestActivation(userId: UserId): void {
    void this.activate(userId);
  }

  private async activate(userId: UserId): Promise<void> {
    const status = await firstValueFrom(this.authService.authStatusFor$(userId));
    if (status === AuthenticationStatus.Unlocked) {
      await this.accountService.switchAccount(userId);
    }
  }
}
