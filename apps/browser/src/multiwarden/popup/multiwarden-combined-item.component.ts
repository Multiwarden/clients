import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import { MultiwardenCombinedService } from "@bitwarden/angular/multiwarden";
import { AvatarModule, IconModule, ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** Multiwarden: the "Combined" choice at the top of the account switcher page. */
@Component({
  selector: "app-multiwarden-combined-item",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule, IconModule, ItemModule, I18nPipe],
  template: `
    @if (accounts().length > 1) {
      <bit-item class="tw-mb-6">
        <button
          id="account-switcher_button_combined"
          bit-item-content
          type="button"
          (click)="choose()"
          data-testid="multiwarden-combined-option"
        >
          <span slot="start" class="tw-flex tw-items-center" aria-hidden="true">
            @for (account of avatars(); track account.userId; let first = $first) {
              <bit-avatar
                [class.-tw-ms-3]="!first"
                [id]="account.userId"
                [text]="account.name"
                [color]="account.avatarColor ?? undefined"
              ></bit-avatar>
            }
          </span>
          {{ "multiwardenCombined" | i18n }}
          <span slot="secondary" class="tw-text-sm tw-text-muted">
            {{ "multiwardenCombinedDesc" | i18n }}
          </span>
          @if (on()) {
            <bit-icon
              slot="end"
              name="bwi-check-circle"
              class="tw-text-lg"
              [ariaLabel]="'multiwardenCurrentView' | i18n"
            ></bit-icon>
          }
        </button>
      </bit-item>
    }
  `,
})
export class MultiwardenCombinedItemComponent {
  private readonly combined = inject(MultiwardenCombinedService);
  private readonly router = inject(Router);

  protected readonly accounts = toSignal(this.combined.accounts$, { initialValue: [] });
  protected readonly on = toSignal(this.combined.enabled$, { initialValue: false });
  protected readonly avatars = computed(() =>
    this.accounts()
      .filter((a) => a.unlocked)
      .slice(0, 2),
  );

  protected async choose() {
    await this.combined.setCombined(true);
    await this.router.navigate(["/tabs/vault"]);
  }
}
