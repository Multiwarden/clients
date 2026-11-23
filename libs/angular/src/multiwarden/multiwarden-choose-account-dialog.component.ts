import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { UserId } from "@bitwarden/common/types/guid";
import {
  AvatarModule,
  ButtonModule,
  DialogModule,
  IconModule,
  ItemModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { MultiwardenAccount } from "./multiwarden-combined.service";

export type MultiwardenChooseAccountDialogData = { accounts: MultiwardenAccount[] };

/** Multiwarden: asks which account's vault a new item goes into. Closes with that user id. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarModule,
    ButtonModule,
    DialogModule,
    IconModule,
    ItemModule,
    TypographyModule,
    I18nPipe,
  ],
  template: `
    <bit-simple-dialog>
      <bit-icon bitDialogIcon name="bwi-vault" class="tw-text-3xl tw-text-primary-600" />
      <div bitDialogTitle>{{ "multiwardenChooseVault" | i18n }}</div>
      <div bitDialogContent class="tw-flex tw-w-full tw-flex-col">
        <p bitTypography="body1">{{ "multiwardenChooseVaultDesc" | i18n }}</p>
        <bit-item-group>
          @for (account of data.accounts; track account.userId) {
            <bit-item>
              <button
                [id]="'multiwarden-choose-vault_button_' + $index"
                bit-item-content
                type="button"
                (click)="choose(account.userId)"
              >
                <bit-avatar
                  slot="start"
                  size="sm"
                  [id]="account.userId"
                  [text]="account.name"
                  [color]="account.avatarColor ?? undefined"
                  aria-hidden="true"
                ></bit-avatar>
                <span class="tw-truncate">{{ account.email }}</span>
              </button>
            </bit-item>
          }
        </bit-item-group>
      </div>
      <div bitDialogFooter class="tw-flex tw-flex-col tw-gap-2">
        <button id="multiwarden-choose-vault_button_cancel" bitButton type="button" bitDialogClose>
          {{ "cancel" | i18n }}
        </button>
      </div>
    </bit-simple-dialog>
  `,
})
export class MultiwardenChooseAccountDialogComponent {
  protected readonly data = inject<MultiwardenChooseAccountDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<UserId | undefined>>(DialogRef);

  protected choose(userId: UserId) {
    this.dialogRef.close(userId);
  }
}
