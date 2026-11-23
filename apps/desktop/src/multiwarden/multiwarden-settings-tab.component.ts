import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { defer, map } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  CheckboxModule,
  FormFieldModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { MultiwardenSettingsService } from "./multiwarden-settings.service";
import { MULTIWARDEN_REPOSITORY, multiwardenVersion } from "./multiwarden-version";

/** Multiwarden: the "Multiwarden" tab of the desktop settings dialog. */
@Component({
  selector: "app-multiwarden-settings-tab",
  templateUrl: "multiwarden-settings-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CheckboxModule,
    FormFieldModule,
    LinkModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class MultiwardenSettingsTabComponent {
  private readonly settingsService = inject(MultiwardenSettingsService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly settings = toSignal(this.settingsService.settings$);

  protected readonly versions = toSignal(
    defer(async () => await this.platformUtilsService.getApplicationVersion()).pipe(
      map((bitwarden) =>
        bitwarden ? { bitwarden, multiwarden: multiwardenVersion(bitwarden) } : undefined,
      ),
    ),
  );

  protected readonly links = {
    source: MULTIWARDEN_REPOSITORY,
    releases: `${MULTIWARDEN_REPOSITORY}/releases`,
    issues: `${MULTIWARDEN_REPOSITORY}/issues`,
  };

  protected async setHidePremiumNotices(hide: boolean) {
    await this.settingsService.update({ hidePremiumNotices: hide });
  }

  protected open(url: string) {
    this.platformUtilsService.launchUri(url);
  }
}
