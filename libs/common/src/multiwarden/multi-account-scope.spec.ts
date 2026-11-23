import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "../auth/abstractions/account.service";
import { AuthService } from "../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../auth/enums/authentication-status";
import { UserId } from "../types/guid";

import { MultiAccountScope } from "./multi-account-scope";

const userA = "user-a" as UserId;
const userB = "user-b" as UserId;
const userC = "user-c" as UserId;

function setup(activeId: UserId | null, statuses: Record<string, AuthenticationStatus>) {
  const accounts$ = new BehaviorSubject({
    [userA]: { email: "a@example.com", name: "A" },
    [userB]: { email: "b@example.com", name: "B" },
    [userC]: { email: "c@example.com", name: "C" },
  });
  const activeAccount$ = new BehaviorSubject(
    activeId ? { id: activeId, email: `${activeId}@example.com` } : null,
  );
  const authStatuses$ = new BehaviorSubject(statuses);
  const accountService = mock<AccountService>();
  accountService.accounts$ = accounts$ as unknown as AccountService["accounts$"];
  accountService.activeAccount$ = activeAccount$ as unknown as AccountService["activeAccount$"];
  const authService = mock<AuthService>();
  authService.authStatuses$ = authStatuses$ as unknown as AuthService["authStatuses$"];
  return new MultiAccountScope(accountService, authService);
}

describe("MultiAccountScope", () => {
  it("lists unlocked accounts with the active account first", async () => {
    const scope = setup(userB, {
      [userA]: AuthenticationStatus.Unlocked,
      [userB]: AuthenticationStatus.Unlocked,
      [userC]: AuthenticationStatus.Locked,
    });

    expect(await scope.unlockedUserIds()).toEqual([userB, userA]);
    expect(await scope.hasMultipleUnlocked()).toBe(true);
  });

  it("collects items from every unlocked account and remembers their owners", async () => {
    const scope = setup(userA, {
      [userA]: AuthenticationStatus.Unlocked,
      [userB]: AuthenticationStatus.Unlocked,
    });

    const items = await scope.collectItems(async (userId) =>
      userId === userA ? [{ id: "cipher-1" }] : [{ id: "cipher-2" }, { id: "cipher-3" }],
    );

    expect(items.map((i) => i.id)).toEqual(["cipher-1", "cipher-2", "cipher-3"]);
    expect(scope.ownerOf("cipher-1")).toBe(userA);
    expect(scope.ownerOf("cipher-3")).toBe(userB);
  });

  it("keeps results from healthy accounts when one account fails", async () => {
    const scope = setup(userA, {
      [userA]: AuthenticationStatus.Unlocked,
      [userB]: AuthenticationStatus.Unlocked,
    });

    const items = await scope.collectItems(async (userId) => {
      if (userId === userA) {
        throw new Error("still decrypting");
      }
      return [{ id: "cipher-b" }];
    });

    expect(items).toEqual([{ id: "cipher-b" }]);
  });

  it("resolves the owner of an unknown cipher by asking each unlocked account", async () => {
    const scope = setup(userA, {
      [userA]: AuthenticationStatus.Unlocked,
      [userB]: AuthenticationStatus.Unlocked,
    });

    const owner = await scope.resolveOwner("cipher-x", async (userId) => userId === userB);

    expect(owner).toBe(userB);
    expect(scope.ownerOf("cipher-x")).toBe(userB);
  });

  it("does not return a remembered owner that has since been locked", async () => {
    const scope = setup(userA, {
      [userA]: AuthenticationStatus.Unlocked,
      [userB]: AuthenticationStatus.Locked,
    });
    scope.remember("cipher-y", userB);

    const owner = await scope.resolveOwner("cipher-y", async () => false);

    expect(owner).toBe(userA);
  });

  it("labels an account with its email", async () => {
    const scope = setup(userA, { [userA]: AuthenticationStatus.Unlocked });

    expect(await scope.labelFor(userC)).toBe("c@example.com");
    expect(await scope.hasMultipleUnlocked()).toBe(false);
  });
});
