import { APP_INITIALIZER } from "@angular/core";
import { NEVER } from "rxjs";

import { applyMultiwardenHidePremium, MultiwardenPlatform } from "@bitwarden/angular/multiwarden";
import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";

import { DesktopMultiwardenPlatform } from "./desktop-multiwarden-platform";
import { MultiwardenSettingsService } from "./multiwarden-settings.service";

/** Multiwarden: everything the desktop app adds to its root providers. */
export const MULTIWARDEN_DESKTOP_PROVIDERS: SafeProvider[] = [
  safeProvider({
    provide: MultiwardenPlatform,
    useClass: DesktopMultiwardenPlatform,
    deps: [],
  }),
  safeProvider({
    provide: APP_INITIALIZER as SafeInjectionToken<() => void>,
    useFactory: (settings: MultiwardenSettingsService) => () =>
      applyMultiwardenHidePremium(settings.setting$("hidePremiumNotices"), NEVER),
    deps: [MultiwardenSettingsService],
    multi: true,
  }),
];
