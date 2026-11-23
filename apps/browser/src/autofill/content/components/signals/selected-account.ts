/**
 * Multiwarden: the unlocked accounts the save prompt can save to, and the chosen one.
 * Empty when only one account is unlocked, in which case no account selector is shown.
 *
 * Plain get/set stores rather than lit signals: nothing re-renders on change by itself, the
 * bar re-renders explicitly through `accountChange`.
 */
export type MultiwardenAccountOption = {
  userId: string;
  email: string;
  avatar?: { background: string; foreground: string; initials: string };
};

function store<T>(initial: T) {
  let value = initial;
  return {
    get: (): T => value,
    set: (next: T): void => {
      value = next;
    },
  };
}

export const availableAccounts = store<MultiwardenAccountOption[]>([]);

export const selectedAccount = store<string>("");

/** Called by the account selector; the bar sets it to reload folders for the new account. */
export const accountChange: { handler?: (userId: string) => void } = {};
