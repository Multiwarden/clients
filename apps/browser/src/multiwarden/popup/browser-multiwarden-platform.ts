import { Injectable, inject } from "@angular/core";

import { MultiwardenPlatform } from "@bitwarden/angular/multiwarden";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { multiwardenSetting$, updateMultiwardenSettings } from "../multiwarden-settings";

/**
 * Multiwarden: the browser extension's side of combined mode. The choice lives in Multiwarden's
 * settings (extension local storage); activation is done by the background
 * (`multiwardenActivateAccount` in runtime.background.ts).
 */
@Injectable()
export class BrowserMultiwardenPlatform extends MultiwardenPlatform {
  private readonly messagingService = inject(MessagingService);

  readonly combinedMode$ = multiwardenSetting$("combinedMode");

  async setCombinedMode(on: boolean): Promise<void> {
    await updateMultiwardenSettings({ combinedMode: on });
  }

  requestActivation(userId: UserId): void {
    this.messagingService.send("multiwardenActivateAccount", { userId });
  }
}
