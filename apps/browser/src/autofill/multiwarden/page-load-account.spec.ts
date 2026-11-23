import { UserId } from "@bitwarden/common/types/guid";

import { PageLoadAutofillAccount } from "../../multiwarden/multiwarden-settings";

import { choosePageLoadAccount } from "./page-load-account";

const work = "work" as UserId;
const home = "home" as UserId;

describe("choosePageLoadAccount", () => {
  it("keeps Bitwarden's behaviour in active mode", () => {
    const logins = [
      { id: "a", userId: home },
      { id: "b", userId: home },
    ];
    expect(choosePageLoadAccount(PageLoadAutofillAccount.Active, work, home, logins)).toBe(work);
  });

  it("uses the remembered account first", () => {
    const logins = [
      { id: "a", userId: work },
      { id: "b", userId: home },
    ];
    expect(choosePageLoadAccount(PageLoadAutofillAccount.Remembered, work, home, logins)).toBe(
      home,
    );
  });

  it("falls back to a unique match when nothing is remembered", () => {
    const logins = [{ id: "a", userId: home }];
    expect(choosePageLoadAccount(PageLoadAutofillAccount.Remembered, work, undefined, logins)).toBe(
      home,
    );
  });

  it("does not fill when several logins match across accounts", () => {
    const logins = [
      { id: "a", userId: work },
      { id: "b", userId: home },
    ];
    expect(
      choosePageLoadAccount(PageLoadAutofillAccount.Remembered, work, undefined, logins),
    ).toBeUndefined();
    expect(
      choosePageLoadAccount(PageLoadAutofillAccount.Unique, work, home, logins),
    ).toBeUndefined();
  });

  it("treats a login shared through an organization as one match", () => {
    const logins = [
      { id: "shared", userId: work },
      { id: "shared", userId: home },
    ];
    expect(choosePageLoadAccount(PageLoadAutofillAccount.Unique, work, undefined, logins)).toBe(
      work,
    );
  });
});
