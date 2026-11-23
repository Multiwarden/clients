import { html } from "lit";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { Theme } from "@bitwarden/common/platform/enums";

import { Option, OrgView, FolderView, I18n, CollectionView } from "../common-types";
import { Business, Family, Folder, User, CollectionShared } from "../icons";
import { ButtonRow } from "../rows/button-row";
import {
  accountChange,
  availableAccounts,
  selectedAccount as selectedAccountSignal,
} from "../signals/selected-account";
import { selectedCollection as selectedCollectionSignal } from "../signals/selected-collection";
import { selectedFolder as selectedFolderSignal } from "../signals/selected-folder";
import { selectedVault as selectedVaultSignal } from "../signals/selected-vault";

function getVaultIconByProductTier(productTierType?: ProductTierType): Option["icon"] {
  switch (productTierType) {
    case ProductTierType.Free:
    case ProductTierType.Families:
      return Family;
    case ProductTierType.Teams:
    case ProductTierType.Enterprise:
    case ProductTierType.TeamsStarter:
      return Business;
    default:
      return User;
  }
}

/** Multiwarden: the account's own avatar (colour and initials) as an option icon. */
function AccountAvatarIcon(avatar: {
  background: string;
  foreground: string;
  initials: string;
}): Option["icon"] {
  return () => html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill=${avatar.background}></circle>
      <text
        x="8"
        y="8"
        dy="0.35em"
        text-anchor="middle"
        font-size="7"
        font-weight="600"
        font-family="Inter, Roboto, sans-serif"
        fill=${avatar.foreground}
      >
        ${avatar.initials}
      </text>
    </svg>
  `;
}

// Value represents default selector state outside of data-driven state
const defaultNoneSelectValue = "0";

export type NotificationButtonRowProps = {
  collections?: CollectionView[];
  folders?: FolderView[];
  i18n: I18n;
  organizations?: OrgView[];
  primaryButton: {
    text: string;
    isLoading?: boolean;
    handlePrimaryButtonClick: (args: any) => void;
  };
  personalVaultIsAllowed: boolean;
  theme: Theme;
};

export function NotificationButtonRow({
  collections,
  folders,
  i18n,
  organizations,
  primaryButton,
  personalVaultIsAllowed,
  theme,
}: NotificationButtonRowProps) {
  const currentUserVaultOption: Option = {
    icon: User,
    default: true,
    text: i18n.myVault,
    value: defaultNoneSelectValue,
  };

  // Do not include user vault if disallowed by org policy
  const initialVaultOptions = [
    ...(personalVaultIsAllowed ? [currentUserVaultOption] : []),
  ] as Option[];

  const vaultOptions: Option[] = organizations?.length
    ? organizations.reduce((options, { id, name, productTierType }: OrgView) => {
        const icon = getVaultIconByProductTier(productTierType);
        return [
          ...options,
          {
            icon,
            text: name,
            value: id,
          },
        ];
      }, initialVaultOptions)
    : initialVaultOptions;

  const folderOptions: Option[] = folders?.length
    ? folders.reduce<Option[]>(
        (options, { id, name }: FolderView) => [
          ...options,
          {
            icon: Folder,
            text: name,
            value: !id ? defaultNoneSelectValue : id,
            default: !id,
          },
        ],
        [],
      )
    : [];

  const collectionOptions: Option[] = collections?.length
    ? collections.reduce<Option[]>(
        (options, { id, name }: any) => [
          ...options,
          {
            icon: CollectionShared,
            text: name,
            value: id === null ? defaultNoneSelectValue : id,
            default: id === null,
          },
        ],
        [],
      )
    : [];

  if (vaultOptions.length === 1) {
    selectedVaultSignal?.set(vaultOptions[0].value);

    // If the individual vault is disabled by a vault policy,
    // a collection selection is required
    if (
      !personalVaultIsAllowed &&
      collections?.length &&
      selectedCollectionSignal.get() === defaultNoneSelectValue
    ) {
      selectedCollectionSignal?.set(collections[0].id);
    }
  }

  // Multiwarden: pick which unlocked account the login is saved to.
  const accounts = availableAccounts.get();
  const accountOptions: Option[] = accounts.map(({ userId, email, avatar }) => ({
    icon: avatar ? AccountAvatarIcon(avatar) : User,
    text: email,
    value: userId,
    default: userId === selectedAccountSignal.get(),
  }));

  return html`
    ${ButtonRow({
      theme,
      primaryButton,
      selectButtons: [
        ...(accountOptions.length > 1
          ? [
              {
                id: "multiwarden-account",
                label: i18n.multiwardenAccount,
                options: accountOptions,
                selectedSignal: selectedAccountSignal,
                handleSelectionUpdate: (userId: string) => accountChange.handler?.(userId),
              },
            ]
          : []),
        ...(vaultOptions.length > 1
          ? [
              {
                id: "organization",
                label: i18n.vault,
                options: vaultOptions,
                selectedSignal: selectedVaultSignal,
              },
            ]
          : []),
        ...(folderOptions.length > 1 && !collectionOptions.length
          ? [
              {
                id: "folder",
                label: i18n.folder,
                options: folderOptions,
                selectedSignal: selectedFolderSignal,
              },
            ]
          : []),
        ...(collectionOptions.length > 1
          ? [
              {
                id: "collection",
                label: i18n.collection,
                options: collectionOptions,
                selectedSignal: selectedCollectionSignal,
              },
            ]
          : []),
      ],
    })}
  `;
}
