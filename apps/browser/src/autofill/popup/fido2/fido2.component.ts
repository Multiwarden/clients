import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  map,
  Observable,
  Subject,
  take,
  takeUntil,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  MultiAccountScope,
  UnlockedAccount,
} from "@bitwarden/common/multiwarden/multi-account-scope";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import {
  ButtonModule,
  DialogService,
  ItemModule,
  StatusLockupComponent,
  SearchModule,
  SectionComponent,
  SectionHeaderComponent,
  SvgComponent,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { ZonedMessageListenerService } from "../../../platform/browser/zoned-message-listener.service";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { VaultPopoutType } from "../../../vault/popup/utils/vault-popout-window";
import {
  BrowserFido2Message,
  BrowserFido2UserInterfaceSession,
  BrowserFido2MessageTypes,
} from "../../fido2/services/browser-fido2-user-interface.service";
import {
  getLastAccountForSite as getLastPasskeyAccount,
  setLastAccountForSite as setLastPasskeyAccount,
} from "../../multiwarden/last-account";
import { CipherUse, FillCipherPolicy } from "../../services/abstractions/fill-cipher-policy";

import { Fido2CipherRowComponent } from "./fido2-cipher-row.component";
import { Fido2UseBrowserLinkComponent } from "./fido2-use-browser-link.component";

const PasskeyActions = {
  Register: "register",
  Authenticate: "authenticate",
} as const;

type PasskeyActionValue = (typeof PasskeyActions)[keyof typeof PasskeyActions];

interface ViewData {
  message: BrowserFido2Message;
  fallbackSupported: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-fido2",
  templateUrl: "fido2.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    Fido2CipherRowComponent,
    Fido2UseBrowserLinkComponent,
    FormsModule,
    ItemModule,
    JslibModule,
    StatusLockupComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    SearchModule,
    SectionComponent,
    SectionHeaderComponent,
    SvgComponent,
  ],
})
export class Fido2Component implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private message$ = new BehaviorSubject<BrowserFido2Message | null>(null);
  protected BrowserFido2MessageTypes = BrowserFido2MessageTypes;
  protected cipher: CipherView | null = null;
  protected ciphers: CipherView[] = [];
  protected data$!: Observable<ViewData>;
  protected displayedCiphers: CipherView[] = [];
  protected equivalentDomains: Set<string> = new Set();
  protected equivalentDomainsURL: string | undefined = undefined;
  protected loading = false;
  protected noResultsIcon = NoResults;
  protected passkeyAction: PasskeyActionValue = PasskeyActions.Register;
  protected PasskeyActions = PasskeyActions;
  protected hasSearched = false;
  protected searchText: string | null = null;
  protected searchTypeSearch = false;
  protected senderTabId: string | undefined = undefined;
  protected sessionId: string | undefined = undefined;
  protected showNewPasskeyButton: boolean = false;
  protected url: string | undefined = undefined;
  /** Multiwarden: unlocked accounts, and the one a new passkey login is saved to. */
  protected accounts: UnlockedAccount[] = [];
  protected selectedUserId: UserId | undefined = undefined;
  protected accountLabels = new Map<string, string>();
  private multiAccountScope!: MultiAccountScope;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private domainSettingsService: DomainSettingsService,
    private searchService: SearchService,
    private logService: LogService,
    private dialogService: DialogService,
    private browserMessagingApi: ZonedMessageListenerService,
    private passwordRepromptService: PasswordRepromptService,
    private accountService: AccountService,
    private fillCipherPolicy: FillCipherPolicy,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.multiAccountScope = new MultiAccountScope(this.accountService, this.authService);
    this.searchTypeSearch = !this.platformUtilsService.isSafari();

    const queryParams$ = this.activatedRoute.queryParamMap.pipe(
      take(1),
      map((queryParamMap) => ({
        sessionId: queryParamMap.get("sessionId") ?? undefined,
        senderTabId: queryParamMap.get("senderTabId") ?? undefined,
        senderUrl: queryParamMap.get("senderUrl") ?? undefined,
      })),
    );

    combineLatest([
      queryParams$,
      this.browserMessagingApi.messageListener$() as Observable<BrowserFido2Message>,
    ])
      .pipe(
        concatMap(async ([queryParams, message]) => {
          this.sessionId = queryParams.sessionId;
          this.senderTabId = queryParams.senderTabId;
          this.url = queryParams.senderUrl;
          // For a 'NewSessionCreatedRequest', abort if it doesn't belong to the current session.
          if (
            message.type === BrowserFido2MessageTypes.NewSessionCreatedRequest &&
            message.sessionId !== queryParams.sessionId
          ) {
            this.abort(false);
            return;
          }

          // Ignore messages that don't belong to the current session.
          if (message.sessionId !== queryParams.sessionId) {
            return;
          }

          if (message.type === BrowserFido2MessageTypes.AbortRequest) {
            this.abort(false);
            return;
          }

          return message;
        }),
        filter((message) => !!message),
        takeUntil(this.destroy$),
      )
      .subscribe((message) => {
        this.message$.next(message);
      });

    this.data$ = this.message$.pipe(
      filter((message): message is BrowserFido2Message => message != null),
      concatMap(async (message) => {
        switch (message.type) {
          case BrowserFido2MessageTypes.ConfirmNewCredentialRequest: {
            if (this.url == null) {
              this.displayedCiphers = [];
              break;
            }
            const url = this.url;
            const equivalentDomains = await firstValueFrom(
              this.domainSettingsService.getUrlEquivalentDomains(url),
            );

            // Multiwarden: offer matching logins from every unlocked account.
            await this.loadAccounts(message.rpId);
            this.ciphers = (
              await this.collectLabeled((userId) =>
                this.fillCipherPolicy.ciphers(userId, CipherUse.Passkey),
              )
            ).filter((cipher) => cipher.type === CipherType.Login && !cipher.isDeleted);

            this.displayedCiphers = this.ciphers.filter(
              (cipher) =>
                cipher.login.matchesUri(url, equivalentDomains) &&
                Fido2Utils.cipherHasNoOtherPasskeys(cipher, message.userHandle),
            );

            this.passkeyAction = PasskeyActions.Register;

            // @TODO fix new cipher creation for other fido2 registration message types and remove `showNewPasskeyButton` from the template
            this.showNewPasskeyButton = true;

            break;
          }

          case BrowserFido2MessageTypes.PickCredentialRequest: {
            await this.loadAccounts();
            this.ciphers = await this.decryptFromOwners(message.cipherIds);

            this.displayedCiphers = [...this.ciphers];

            this.passkeyAction = PasskeyActions.Authenticate;

            break;
          }

          case BrowserFido2MessageTypes.InformExcludedCredentialRequest: {
            await this.loadAccounts();
            this.ciphers = await this.decryptFromOwners(message.existingCipherIds);

            this.displayedCiphers = [...this.ciphers];

            this.passkeyAction = PasskeyActions.Register;

            break;
          }

          case BrowserFido2MessageTypes.InformCredentialNotFoundRequest: {
            this.passkeyAction = PasskeyActions.Authenticate;

            break;
          }
        }

        return {
          message,
          fallbackSupported: "fallbackSupported" in message && message.fallbackSupported,
        };
      }),

      takeUntil(this.destroy$),
    );

    queryParams$.pipe(takeUntil(this.destroy$)).subscribe((queryParams) => {
      if (queryParams.sessionId != null) {
        this.send({
          sessionId: queryParams.sessionId,
          type: BrowserFido2MessageTypes.ConnectResponse,
        });
      }
    });
  }

  protected async submit() {
    const data = this.message$.value;
    if (this.sessionId == null || this.cipher == null) {
      return;
    }

    if (data?.type === BrowserFido2MessageTypes.PickCredentialRequest) {
      // TODO: Revert to use fido2 user verification service once user verification for passkeys is approved for production.
      // PM-4577 - https://github.com/bitwarden/clients/pull/8746
      const userVerified = await this.handleUserVerification(data.userVerification, this.cipher);

      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher.id,
        type: BrowserFido2MessageTypes.PickCredentialResponse,
        userVerified,
      });
    } else if (data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest) {
      if (this.cipher.login.hasFido2Credentials) {
        const confirmed = await this.dialogService.openSimpleDialog({
          title: { key: "overwritePasskey" },
          content: { key: "overwritePasskeyAlert" },
          type: "warning",
        });

        if (!confirmed) {
          return false;
        }
      }

      // TODO: Revert to use fido2 user verification service once user verification for passkeys is approved for production.
      // PM-4577 - https://github.com/bitwarden/clients/pull/8746
      const userVerified = await this.handleUserVerification(data.userVerification, this.cipher);

      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher.id,
        type: BrowserFido2MessageTypes.ConfirmNewCredentialResponse,
        userVerified,
      });
    }

    this.loading = true;
  }

  protected async saveNewLogin() {
    const data = this.message$.value;

    if (data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest) {
      const name = data.credentialName || data.rpId;
      // TODO: Revert to check for user verification once user verification for passkeys is approved for production.
      // PM-4577 - https://github.com/bitwarden/clients/pull/8746
      await this.createNewCipher(name, data.userName);

      if (this.sessionId == null || this.cipher == null) {
        return;
      }
      // We are bypassing user verification pending approval.
      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher.id,
        type: BrowserFido2MessageTypes.ConfirmNewCredentialResponse,
        userVerified: data.userVerification,
      });
    }

    this.loading = true;
  }

  async handleCipherItemSelect(item: CipherView) {
    this.cipher = item;
    const owner = this.multiAccountScope.ownerOf(item.id);
    const data = this.message$.value;
    if (owner && data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest) {
      await setLastPasskeyAccount(data.rpId, owner);
    }

    await this.submit();
  }

  async addCipher() {
    const data = this.message$.value;

    // Multiwarden: the add-item page works on the active account. For another account,
    // save the passkey as a new login directly in the chosen account instead.
    if (this.selectedUserId && !this.isActiveAccount(this.selectedUserId)) {
      await this.saveNewLogin();
      return;
    }

    if (
      data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest &&
      this.sessionId != null &&
      this.url != null
    ) {
      await this.router.navigate(["/add-cipher"], {
        queryParams: {
          type: CipherType.Login.toString(),
          name: data.credentialName || data.rpId,
          uri: this.url,
          uilocation: "popout",
          username: data.userName,
          senderTabId: this.senderTabId,
          sessionId: this.sessionId,
          userVerification: data.userVerification,
          singleActionPopout: `${VaultPopoutType.fido2Popout}_${this.sessionId}`,
        },
      });
    }

    return;
  }

  async getEquivalentDomains(): Promise<Set<string>> {
    if (this.url == null) {
      return this.equivalentDomains;
    }
    if (this.equivalentDomainsURL !== this.url) {
      this.equivalentDomainsURL = this.url;
      this.equivalentDomains = await firstValueFrom(
        this.domainSettingsService.getUrlEquivalentDomains(this.url),
      );
    }

    return this.equivalentDomains;
  }

  async clearSearch() {
    this.searchText = "";
    await this.setDisplayedCiphersToAllDomainMatch();
  }

  protected async setDisplayedCiphersToAllDomainMatch() {
    if (this.url == null) {
      this.displayedCiphers = [...this.ciphers];
      return;
    }
    const url = this.url;
    const equivalentDomains = await this.getEquivalentDomains();
    this.displayedCiphers = this.ciphers.filter((cipher) =>
      cipher.login.matchesUri(url, equivalentDomains),
    );
  }

  protected async search() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this.hasSearched = true;
    const isSearchable = await this.searchService.isSearchable(this.searchText);

    if (isSearchable && this.searchText !== null) {
      this.displayedCiphers = await this.searchService.searchCiphers(
        userId,
        null,
        this.searchText,
        this.ciphers,
      );
    } else {
      await this.setDisplayedCiphersToAllDomainMatch();
    }
  }

  abort(fallback: boolean) {
    this.unload(fallback);
    window.close();
  }

  unload(fallback = false) {
    if (this.sessionId == null) {
      return;
    }
    this.send({
      sessionId: this.sessionId,
      type: BrowserFido2MessageTypes.AbortResponse,
      fallbackRequested: fallback,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildCipher(name: string, username: string) {
    if (this.url == null) {
      return;
    }
    const url = this.url;
    this.cipher = new CipherView();
    this.cipher.name = name;

    this.cipher.type = CipherType.Login;
    this.cipher.login = new LoginView();
    this.cipher.login.username = username;
    this.cipher.login.uris = [new LoginUriView()];
    this.cipher.login.uris[0].uri = url;
    this.cipher.card = new CardView();
    this.cipher.identity = new IdentityView();
    this.cipher.secureNote = new SecureNoteView();
    this.cipher.secureNote.type = SecureNoteType.Generic;
    this.cipher.reprompt = CipherRepromptType.None;
  }

  private async createNewCipher(name: string, username: string) {
    // Multiwarden: save into the account picked in the popup.
    const activeUserId =
      this.selectedUserId ??
      (await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId)));
    const data = this.message$.value;
    if (data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest) {
      await setLastPasskeyAccount(data.rpId, activeUserId);
    }

    this.buildCipher(name, username);
    if (this.cipher == null) {
      return;
    }
    try {
      const result = await this.cipherService.createWithServer(this.cipher, activeUserId);
      this.cipher.id = result.id;
    } catch (e) {
      this.logService.error(e);
    }
  }

  /** Multiwarden: loads unlocked accounts and picks the default save target for this site. */
  private async loadAccounts(rpId?: string) {
    this.accounts = await this.multiAccountScope.unlockedAccounts();
    const last = rpId ? await getLastPasskeyAccount(rpId) : undefined;
    const fallback = this.accounts.find((a) => a.isActive) ?? this.accounts[0];
    this.selectedUserId = this.accounts.some((a) => a.userId === last) ? last : fallback?.userId;
  }

  protected get showAccountPicker(): boolean {
    return this.accounts.length > 1;
  }

  protected accountLabel(cipher: CipherView): string | undefined {
    return this.showAccountPicker ? this.accountLabels.get(cipher.id) : undefined;
  }

  protected selectedAccountEmail(): string {
    return this.accounts.find((a) => a.userId === this.selectedUserId)?.email ?? "";
  }

  private isActiveAccount(userId: UserId): boolean {
    return this.accounts.find((a) => a.userId === userId)?.isActive ?? true;
  }

  /** Multiwarden: loads ciphers from every unlocked account and labels each with its account. */
  private async collectLabeled(load: (userId: UserId) => Promise<CipherView[]>) {
    const results = await this.multiAccountScope.collect(load);
    for (const { item, userId } of results) {
      const email = this.accounts.find((a) => a.userId === userId)?.email;
      if (email) {
        this.accountLabels.set(item.id, email);
      }
    }
    return results.map((r) => r.item);
  }

  /** Multiwarden: decrypts each cipher with the account that owns it. */
  private async decryptFromOwners(cipherIds: string[]): Promise<CipherView[]> {
    const ciphers = await Promise.all(
      cipherIds.map(async (cipherId) => {
        const owner = await this.multiAccountScope.resolveOwner(
          cipherId,
          async (userId) => (await this.cipherService.get(cipherId, userId)) != null,
        );
        if (owner == null) {
          return null;
        }
        const cipher = await this.cipherService.get(cipherId, owner);
        if (cipher == null) {
          return null;
        }
        const email = this.accounts.find((a) => a.userId === owner)?.email;
        if (email) {
          this.accountLabels.set(cipherId, email);
        }
        return this.cipherService.decrypt(cipher, owner);
      }),
    );
    return ciphers.filter((c): c is CipherView => c != null);
  }

  // TODO: Remove and use fido2 user verification service once user verification for passkeys is approved for production.
  private async handleUserVerification(
    userVerificationRequested: boolean,
    cipher: CipherView,
  ): Promise<boolean> {
    const masterPasswordRepromptRequired = cipher && cipher.reprompt !== 0;

    if (masterPasswordRepromptRequired) {
      return await this.passwordRepromptService.showPasswordPrompt();
    }

    return userVerificationRequested;
  }

  private send(msg: BrowserFido2Message) {
    BrowserFido2UserInterfaceSession.sendMessage(msg);
  }
}
