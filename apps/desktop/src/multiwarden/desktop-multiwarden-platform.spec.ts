import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { DesktopMultiwardenPlatform } from "./desktop-multiwarden-platform";
import { MultiwardenSettingsService } from "./multiwarden-settings.service";

describe("DesktopMultiwardenPlatform", () => {
  const userId = "user-2" as UserId;
  let accountService: ReturnType<typeof mock<AccountService>>;
  let authService: ReturnType<typeof mock<AuthService>>;
  let combinedMode$: BehaviorSubject<boolean>;
  let settings: { setting$: jest.Mock; update: jest.Mock };
  let platform: DesktopMultiwardenPlatform;

  beforeEach(() => {
    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    combinedMode$ = new BehaviorSubject(false);
    settings = { setting$: jest.fn(() => combinedMode$), update: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        DesktopMultiwardenPlatform,
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: MultiwardenSettingsService, useValue: settings },
      ],
    });
    platform = TestBed.inject(DesktopMultiwardenPlatform);
  });

  it("reads the combined choice from Multiwarden settings", async () => {
    combinedMode$.next(true);
    expect(await firstValueFrom(platform.combinedMode$)).toBe(true);
    expect(settings.setting$).toHaveBeenCalledWith("combinedMode");
  });

  it("stores the combined choice", async () => {
    await platform.setCombinedMode(true);
    expect(settings.update).toHaveBeenCalledWith({ combinedMode: true });
  });

  it("makes an unlocked account active", async () => {
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    platform.requestActivation(userId);
    await new Promise((resolve) => setTimeout(resolve));
    expect(accountService.switchAccount).toHaveBeenCalledWith(userId);
  });

  it("leaves a locked account alone", async () => {
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));
    platform.requestActivation(userId);
    await new Promise((resolve) => setTimeout(resolve));
    expect(accountService.switchAccount).not.toHaveBeenCalled();
  });
});
