import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";

import { AvatarModule } from "@bitwarden/components";

import { MultiwardenCombinedService } from "./multiwarden-combined.service";

/**
 * Multiwarden: the avatar of the account an item belongs to. Shows only in combined mode.
 */
@Component({
  selector: "app-multiwarden-account-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule],
  template: `
    @if (account(); as account) {
      <bit-avatar
        size="sm"
        [id]="account.userId"
        [text]="account.name"
        [color]="account.avatarColor ?? undefined"
        [title]="account.email"
        [attr.aria-label]="account.email"
        data-testid="multiwarden-account-badge"
      ></bit-avatar>
    }
  `,
  host: {
    class: "tw-inline-flex tw-shrink-0 tw-items-center",
    // Lets MultiwardenCombinedService find the item behind any click inside its row.
    "[attr.data-multiwarden-cipher]": "cipherId() ?? null",
  },
})
export class MultiwardenAccountBadgeComponent {
  private readonly combined = inject(MultiwardenCombinedService);

  // `unknown` because list rows carry branded cipher ids (CipherId) or plain strings.
  readonly cipherId = input<unknown>(undefined);

  protected readonly account = toSignal(
    toObservable(this.cipherId).pipe(
      switchMap((id) => this.combined.accountFor$(id == null ? undefined : String(id))),
    ),
  );
}
