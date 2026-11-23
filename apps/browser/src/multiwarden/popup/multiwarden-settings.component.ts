import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  IconModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";
import {
  DEFAULT_MULTIWARDEN_SETTINGS,
  MultiwardenSettings,
  multiwardenSettings$,
  PageLoadAutofillAccount,
  updateMultiwardenSettings,
} from "../multiwarden-settings";

/** Written into the build by multiwarden/scripts/brand-build.mjs. */
type MultiwardenBuildInfo = {
  version: string;
  bitwardenVersion: string;
  upstreamCommit: string;
  repository: string;
};

const REPOSITORY = "https://github.com/multiwarden/clients";

/** Multiwarden: the extension's own settings page (Settings → Multiwarden). */
@Component({
  templateUrl: "multiwarden-settings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ButtonModule,
    ItemModule,
    IconModule,
    LinkModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    CheckboxModule,
    TypographyModule,
    FormFieldModule,
  ],
})
export class MultiwardenSettingsComponent {
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly settings = toSignal(multiwardenSettings$, {
    initialValue: DEFAULT_MULTIWARDEN_SETTINGS,
  });
  protected readonly buildInfo = signal<MultiwardenBuildInfo | null>(null);
  protected readonly pageLoadOptions: { value: PageLoadAutofillAccount; labelKey: string }[] = [
    { value: PageLoadAutofillAccount.Remembered, labelKey: "multiwardenPageLoadRemembered" },
    { value: PageLoadAutofillAccount.Unique, labelKey: "multiwardenPageLoadUnique" },
    { value: PageLoadAutofillAccount.Active, labelKey: "multiwardenPageLoadActive" },
  ];
  protected readonly appVersion = signal<string>("");

  constructor() {
    void this.loadVersion();
  }

  private async loadVersion() {
    this.appVersion.set(await this.platformUtilsService.getApplicationVersion());
    try {
      const response = await fetch("/multiwarden.json");
      if (response.ok) {
        this.buildInfo.set((await response.json()) as MultiwardenBuildInfo);
      }
    } catch {
      // Development builds have no version file; the manifest version still shows.
    }
  }

  protected shortCommit(commit: string | undefined): string {
    return (commit ?? "").slice(0, 9);
  }

  protected async toggle(key: keyof MultiwardenSettings, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await updateMultiwardenSettings({ [key]: checked });
  }

  protected async setPageLoadAccount(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const option = this.pageLoadOptions.find((o) => o.value === value);
    if (option) {
      await updateMultiwardenSettings({ pageLoadAutofillAccount: option.value });
    }
  }

  protected open(path: "" | "releases" | "issues" | "upstream") {
    const repository = this.buildInfo()?.repository ?? REPOSITORY;
    const commit = this.buildInfo()?.upstreamCommit;
    const url =
      path === "upstream"
        ? `https://github.com/bitwarden/clients/commit/${commit}`
        : path === ""
          ? repository
          : `${repository}/${path}`;
    this.platformUtilsService.launchUri(url);
  }
}
