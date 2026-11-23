import { accountAvatar } from "./account-avatar";

describe("accountAvatar", () => {
  it("uses a custom colour with a readable text colour", () => {
    const avatar = accountAvatar("user-1", "Board Astatine", "#ffff00");

    expect(avatar).toEqual({ background: "#ffff00", foreground: "black", initials: "BA" });
  });

  it("maps a named default colour to its hex value", () => {
    expect(accountAvatar("user-1", "mail@mteij.nl", "purple").background).toBe("#8200db");
  });

  it("picks the same default colour for the same account every time", () => {
    const first = accountAvatar("user-42", "mail@mteij.nl", null);
    const second = accountAvatar("user-42", "someone else", undefined);

    expect(first.background).toBe(second.background);
    expect(first.initials).toBe("MA");
  });
});
