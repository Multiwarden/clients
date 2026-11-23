import { Observable, takeUntil } from "rxjs";

import { multiwardenSetting$ } from "../multiwarden-settings";

/**
 * Multiwarden: page-wide effects of Multiwarden settings in the popup.
 *
 * "Hide Premium notices" works with CSS so upstream templates stay untouched, except for a
 * `data-multiwarden-premium` marker on the few upsell callouts that have no component of
 * their own.
 */
const HIDE_PREMIUM_CLASS = "multiwarden-hide-premium";
const STYLE_ID = "multiwarden-popup-styles";

const STYLES = `
html.${HIDE_PREMIUM_CLASS} app-premium-badge,
html.${HIDE_PREMIUM_CLASS} billing-premium-upgrade-nudge,
html.${HIDE_PREMIUM_CLASS} [data-multiwarden-premium] {
  display: none !important;
}
`;

export function applyMultiwardenPopupSettings(
  destroy$: Observable<void>,
  doc: Document = document,
): void {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    doc.head.appendChild(style);
  }
  multiwardenSetting$("hidePremiumNotices")
    .pipe(takeUntil(destroy$))
    .subscribe((hide) => {
      doc.documentElement.classList.toggle(HIDE_PREMIUM_CLASS, hide);
    });
}
