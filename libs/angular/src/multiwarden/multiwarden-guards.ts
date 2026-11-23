import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CenterPositionStrategy, DialogService } from "@bitwarden/components";

import { MultiwardenChooseAccountDialogComponent } from "./multiwarden-choose-account-dialog.component";
import { MultiwardenCombinedService } from "./multiwarden-combined.service";

/**
 * Multiwarden: before an item page (view, edit, clone, attachments, edit Send, ...) opens in
 * combined mode, make the item's account active, so the page loads it from that account.
 */
export const multiwardenCipherOwnerGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  // Sends are owned by an account the same way ciphers are.
  const itemId = route.queryParamMap.get("cipherId") ?? route.queryParamMap.get("sendId");
  if (itemId) {
    await inject(MultiwardenCombinedService).prepareFor(itemId);
  }
  return true;
};

/**
 * Multiwarden: in combined mode, a new item or Send first asks which account it goes into, then
 * opens Bitwarden's normal form with that account active.
 */
export const multiwardenNewItemTargetGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
) => {
  const combined = inject(MultiwardenCombinedService);
  const dialogService = inject(DialogService);

  // Passkey and clone flows already know their account.
  if (
    route.queryParamMap.has("sessionId") ||
    route.queryParamMap.has("cipherId") ||
    route.queryParamMap.has("sendId")
  ) {
    return true;
  }
  if (!(await firstValueFrom(combined.enabled$))) {
    return true;
  }
  const accounts = (await firstValueFrom(combined.accounts$)).filter((a) => a.unlocked);
  if (accounts.length < 2) {
    return true;
  }

  const dialogRef = dialogService.open<UserId | undefined>(
    MultiwardenChooseAccountDialogComponent,
    {
      positionStrategy: new CenterPositionStrategy(),
      data: { accounts },
    },
  );
  const userId = await firstValueFrom(dialogRef.closed);
  if (!userId) {
    return false;
  }
  await combined.activate(userId);
  return true;
};
