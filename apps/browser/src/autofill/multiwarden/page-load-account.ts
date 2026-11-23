import { UserId } from "@bitwarden/common/types/guid";

import { PageLoadAutofillAccount } from "../../multiwarden/multiwarden-settings";

/**
 * Multiwarden: which account autofill on page load may use.
 *
 * @param mode the configured rule
 * @param activeUserId the active account
 * @param remembered the account last used on this site, if any and still unlocked
 * @param logins the matching logins across all unlocked accounts (id and owner)
 * @returns the account to fill from, or undefined to not fill
 */
export function choosePageLoadAccount(
  mode: PageLoadAutofillAccount,
  activeUserId: UserId,
  remembered: UserId | undefined,
  logins: { id: string; userId: UserId }[],
): UserId | undefined {
  if (mode === PageLoadAutofillAccount.Active) {
    return activeUserId;
  }
  if (mode === PageLoadAutofillAccount.Remembered && remembered != null) {
    return remembered;
  }
  const distinct = new Set(logins.map((login) => login.id));
  return distinct.size === 1 ? logins[0].userId : undefined;
}
