import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { registerMultiAccountScope } from "@bitwarden/common/multiwarden/multi-account-scope";
import { UserId } from "@bitwarden/common/types/guid";

import { MultiwardenCombinedService } from "./multiwarden-combined.service";
import { MultiwardenPlatform } from "./multiwarden-platform";

const combinedMode$ = new BehaviorSubject(true);

const userA = "user-a" as UserId;
const userB = "user-b" as UserId;

describe("MultiwardenCombinedService", () => {
  let service: MultiwardenCombinedService;
  let activeAccount$: BehaviorSubject<{ id: UserId; email: string } | null>;
  let requestActivation: jest.Mock;

  beforeEach(() => {
    registerMultiAccountScope(undefined);
    combinedMode$.next(true);
    activeAccount$ = new BehaviorSubject<{ id: UserId; email: string } | null>({
      id: userA,
      email: "a@example.com",
    });
    const accountService = mock<AccountService>();
    accountService.accounts$ = of({
      [userA]: { email: "a@example.com", name: "A" },
      [userB]: { email: "b@example.com", name: "B" },
    }) as unknown as AccountService["accounts$"];
    accountService.activeAccount$ =
      activeAccount$.asObservable() as unknown as AccountService["activeAccount$"];
    const authService = mock<AuthService>();
    authService.authStatuses$ = of({
      [userA]: AuthenticationStatus.Unlocked,
      [userB]: AuthenticationStatus.Unlocked,
    }) as unknown as AuthService["authStatuses$"];
    const avatarService = mock<AvatarService>();
    avatarService.getUserAvatarColor$.mockReturnValue(of(null));
    requestActivation = jest.fn((userId: UserId) =>
      activeAccount$.next({ id: userId, email: `${userId}@example.com` }),
    );
    const platform: MultiwardenPlatform = {
      combinedMode$,
      setCombinedMode: async (on: boolean) => combinedMode$.next(on),
      requestActivation,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: AvatarService, useValue: avatarService },
        { provide: MultiwardenPlatform, useValue: platform },
      ],
    });
    service = TestBed.inject(MultiwardenCombinedService);
  });

  it("merges every unlocked account's items and keeps one copy of shared items", async () => {
    const items = await firstValueFrom(
      service.mergeForUsers((userId) =>
        of(userId === userA ? [{ id: "a1" }, { id: "shared" }] : [{ id: "b1" }, { id: "shared" }]),
      ),
    );

    expect(items.map((i) => i.id)).toEqual(["a1", "shared", "b1"]);
    expect(service.scope?.ownerOf("b1")).toBe(userB);
    expect(service.scope?.ownerOf("shared")).toBe(userA);
  });

  it("only uses the active account when combined mode is off", async () => {
    combinedMode$.next(false);

    const items = await firstValueFrom(
      service.mergeForUsers((userId) => of([{ id: `${userId}-item` }])),
    );

    expect(items.map((i) => i.id)).toEqual(["user-a-item"]);
  });

  it("activates the owning account before acting on an item", async () => {
    await firstValueFrom(service.mergeForUsers((userId) => of([{ id: `${userId}-item` }])));

    await service.prepareFor("user-b-item");

    expect(requestActivation).toHaveBeenCalledWith(userB);
    expect(activeAccount$.value?.id).toBe(userB);
  });

  it("does not switch accounts for an item of the active account", async () => {
    await firstValueFrom(service.mergeForUsers((userId) => of([{ id: `${userId}-item` }])));

    await service.prepareFor("user-a-item");

    expect(requestActivation).not.toHaveBeenCalled();
  });
});
