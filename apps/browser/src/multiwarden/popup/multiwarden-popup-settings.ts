import { Observable } from "rxjs";

import { applyMultiwardenHidePremium } from "@bitwarden/angular/multiwarden";

import { multiwardenSetting$ } from "../multiwarden-settings";

/** Multiwarden: page-wide effects of Multiwarden settings in the popup. */
export function applyMultiwardenPopupSettings(
  destroy$: Observable<void>,
  doc: Document = document,
): void {
  applyMultiwardenHidePremium(multiwardenSetting$("hidePremiumNotices"), destroy$, doc);
}
