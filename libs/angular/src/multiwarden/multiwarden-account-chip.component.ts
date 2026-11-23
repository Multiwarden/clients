import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { AvatarModule, IconModule, MenuModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { MultiwardenAccount, MultiwardenCombinedService } from "./multiwarden-combined.service";

/**
 * Multiwarden: on pages that work on one whole account (Generator, Settings), shows which account
 * that is in combined mode and lets you pick another. Hidden outside combined mode.
 */
@Component({
  selector: "app-multiwarden-account-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule, IconModule, MenuModule, TypographyModule, I18nPipe],
  template: `
    @if (active(); as account) {
      <div class="tw-mb-3 tw-flex tw-items-center tw-gap-2" data-testid="multiwarden-account-chip">
        <span bitTypography="body2" class="tw-text-muted">{{ label() | i18n }}</span>
        <button
          id="multiwarden-account-chip_button_account"
          type="button"
          class="tw-flex tw-min-w-0 tw-items-center tw-gap-2 tw-rounded-full tw-border tw-border-solid tw-border-secondary-300 tw-bg-background tw-py-0.5 tw-pl-0.5 tw-pr-3 tw-text-sm tw-text-main hover:tw-border-primary-600"
          [bitMenuTriggerFor]="accountMenu"
        >
          <bit-avatar
            size="sm"
            [id]="account.userId"
            [text]="account.name"
            [color]="account.avatarColor ?? undefined"
            aria-hidden="true"
          ></bit-avatar>
          <span class="tw-truncate">{{ account.email }}</span>
          <bit-icon name="bwi-angle-down" class="tw-text-xs" aria-hidden="true"></bit-icon>
        </button>
      </div>
      <bit-menu #accountMenu>
        @for (option of unlocked(); track option.userId) {
          <button
            [id]="'multiwarden-account-chip_button_option-' + $index"
            type="button"
            bitMenuItem
            (click)="choose(option)"
          >
            <bit-avatar
              slot="start"
              size="sm"
              [id]="option.userId"
              [text]="option.name"
              [color]="option.avatarColor ?? undefined"
              aria-hidden="true"
            ></bit-avatar>
            {{ option.email }}
            @if (option.active) {
              <bit-icon slot="end" name="bwi-check" aria-hidden="true"></bit-icon>
            }
          </button>
        }
      </bit-menu>
    }
  `,
})
export class MultiwardenAccountChipComponent {
  private readonly combined = inject(MultiwardenCombinedService);

  /** The i18n key of the text before the chip, e.g. "Settings for". */
  readonly label = input<string>("multiwardenAccount");

  private readonly enabled = toSignal(this.combined.enabled$, { initialValue: false });
  private readonly accounts = toSignal(this.combined.accounts$, { initialValue: [] });

  protected readonly unlocked = computed(() => this.accounts().filter((a) => a.unlocked));
  protected readonly active = computed(() =>
    this.enabled() && this.unlocked().length > 1
      ? this.accounts().find((a) => a.active)
      : undefined,
  );

  protected async choose(account: MultiwardenAccount) {
    await this.combined.activate(account.userId);
  }
}
