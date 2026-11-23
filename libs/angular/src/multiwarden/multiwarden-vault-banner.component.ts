import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map } from "rxjs";

import { AvatarModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { MultiwardenCombinedService } from "./multiwarden-combined.service";

/**
 * Multiwarden: on item pages in combined mode, says which account's vault the page works on.
 */
@Component({
  selector: "app-multiwarden-vault-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule, TypographyModule, I18nPipe],
  template: `
    @if (account(); as account) {
      <div
        class="tw-mb-3 tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-solid tw-border-secondary-300 tw-bg-background tw-px-3 tw-py-2"
        data-testid="multiwarden-vault-banner"
      >
        <bit-avatar
          size="sm"
          [id]="account.userId"
          [text]="account.name"
          [color]="account.avatarColor ?? undefined"
          aria-hidden="true"
        ></bit-avatar>
        <span bitTypography="body2" class="tw-truncate">
          <span class="tw-text-muted">{{ "multiwardenVault" | i18n }}</span>
          {{ account.email }}
        </span>
      </div>
    }
  `,
})
export class MultiwardenVaultBannerComponent {
  private readonly combined = inject(MultiwardenCombinedService);

  protected readonly account = toSignal(
    combineLatest([this.combined.enabled$, this.combined.accounts$]).pipe(
      map(([enabled, accounts]) => (enabled ? accounts.find((a) => a.active) : undefined)),
    ),
  );
}
