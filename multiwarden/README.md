# Multiwarden maintainer notes

Multiwarden is a fork of [bitwarden/clients](https://github.com/bitwarden/clients) that makes the
browser extension work with **several unlocked Bitwarden accounts at the same time**. This file
records exactly where Multiwarden differs from upstream, so that upstream syncs stay easy.

## Design rule: hooks, not rewrites

All new logic lives in Multiwarden-only files. Upstream files get small, commented hooks that
call into them. Every hook is marked with a `Multiwarden:` comment, so
`git grep -n "Multiwarden:"` lists them all.

CI checks that no hook goes missing (for example in a sync that merged badly):
`multiwarden/hooks.json` records how many `Multiwarden:` markers and references to Multiwarden
code each upstream file has, and `multiwarden/scripts/check-hooks.mjs` fails when a file has
fewer. After adding, moving or removing a hook on purpose, run
`node multiwarden/scripts/check-hooks.mjs --update` and commit `hooks.json`.

### Multiwarden-only files

| File                                                                        | What it does                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/common/src/multiwarden/multi-account-scope.ts`                        | Lists unlocked accounts (active account first), loads data from all of them, and remembers which account owns each cipher. Also holds the per-context registry (`registerMultiAccountScope` / `getMultiAccountScope`).                                                                                                      |
| `apps/browser/src/autofill/multiwarden/last-account.ts`                     | Remembers which account you last saved to for each site (hashed site keys).                                                                                                                                                                                                                                                 |
| `apps/browser/src/autofill/content/components/signals/selected-account.ts`  | State for the account selector in the save-password bar.                                                                                                                                                                                                                                                                    |
| `apps/browser/src/multiwarden/multiwarden-settings.ts`                      | Multiwarden's own settings, including `combinedMode` (extension local storage, shared by background and popup).                                                                                                                                                                                                             |
| `libs/common/src/multiwarden/account-avatar.ts`                             | An account's avatar colour and initials as plain values (used by the save-password bar).                                                                                                                                                                                                                                    |
| `libs/angular/src/multiwarden/`                                             | **Shared combined-mode core** for every Angular client: `MultiwardenCombinedService` (which accounts to show, merging per-account lists, item owners, quietly activating an item's account), the account badge, vault banner, "save to which vault?" dialog and route guards. Each client supplies a `MultiwardenPlatform`. |
| `apps/browser/src/multiwarden/popup/browser-multiwarden-platform.ts`        | The extension's `MultiwardenPlatform`: combined choice in Multiwarden settings, activation via the background's `multiwardenActivateAccount` message.                                                                                                                                                                       |
| `apps/browser/src/multiwarden/popup/multiwarden-account-menu.component.*`   | Dropdown on the header avatar: Combined, each account, Manage accounts.                                                                                                                                                                                                                                                     |
| `apps/browser/src/multiwarden/popup/multiwarden-combined-item.component.ts` | "Combined" entry on the account switcher page.                                                                                                                                                                                                                                                                              |
| `apps/browser/src/multiwarden/popup/multiwarden-settings.component.*`       | Settings → Multiwarden page.                                                                                                                                                                                                                                                                                                |
| `apps/browser/src/multiwarden/popup/multiwarden-popup-settings.ts`          | Applies settings page-wide in the popup (CSS that hides Premium notices).                                                                                                                                                                                                                                                   |
| `apps/browser/src/multiwarden/popup/multiwarden-logo.ts`                    | Header logo. Generated by `multiwarden/branding/generate-logo.py` (Open Sans, OFL).                                                                                                                                                                                                                                         |
| `multiwarden/`                                                              | Branding (icons, logo, build script), translations, store material, sync bookkeeping.                                                                                                                                                                                                                                       |
| `.github/workflows/multiwarden-*.yml`                                       | Nightly upstream sync, the Multiwarden build/release, and the Chrome Web Store check.                                                                                                                                                                                                                                       |
| `.github/README.md`                                                         | The repository front page (GitHub shows it instead of upstream's README).                                                                                                                                                                                                                                                   |

### Upstream files with hooks

| File                                                                                                                   | Hook                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/browser/src/background/main.background.ts`                                                                       | Creates and registers the `MultiAccountScope` (with avatar colours); passes it to the passkey authenticator.                                                     |
| `apps/browser/src/popup/services/services.module.ts`                                                                   | Provides `BrowserMultiwardenPlatform`.                                                                                                                           |
| `apps/browser/src/background/runtime.background.ts`                                                                    | `multiwardenActivateAccount` message: makes an unlocked account active without a full switch.                                                                    |
| `apps/browser/src/autofill/background/overlay.background.ts`                                                           | Inline menu loads ciphers from every unlocked account and labels them; works while any account is unlocked.                                                      |
| `apps/browser/src/autofill/services/autofill.service.ts`                                                               | Fill uses the owning account for premium (TOTP) checks and the last-used date.                                                                                   |
| `apps/browser/src/autofill/background/autofill-orchestrator.ts`                                                        | Keyboard shortcut falls back to other accounts; page-load autofill picks its account with `choosePageLoadAccount` (`autofill/multiwarden/page-load-account.ts`). |
| `apps/browser/src/autofill/services/autofill-badge-updater.service.ts`                                                 | Badge counts matching logins in every unlocked account.                                                                                                          |
| `apps/browser/src/autofill/browser/cipher-context-menu-handler.ts`, `context-menu-clicked-handler.ts`                  | Context menu lists every account's items (labelled) and fills from the owning account.                                                                           |
| `apps/browser/src/vault/popup/services/vault-popup-list-filters.service.ts`                                            | In combined view, folders, organizations and collections of every unlocked account.                                                                              |
| `libs/tools/send/send-ui/src/services/send-items.service.ts`, `send-list-items-container/*`                            | In combined view, Sends of every unlocked account, with account badges.                                                                                          |
| `apps/browser/src/tools/popup/generator/*`, `tools/popup/settings/settings-v2.component.*`                             | Account chip (combined view).                                                                                                                                    |
| `apps/browser/src/autofill/background/notification.background.ts`                                                      | Save/update prompt across accounts; account picker; honours the "remember save account" setting.                                                                 |
| `apps/browser/src/autofill/background/abstractions/notification.background.ts`                                         | Types for the new bar messages.                                                                                                                                  |
| `apps/browser/src/autofill/notification/bar.ts`, `.../content/components/notification/button-row.ts`                   | Account selector in the save-password bar.                                                                                                                       |
| `libs/common/src/platform/services/fido2/fido2-authenticator.service.ts`, `fido2-client.service.ts`                    | Passkeys across all unlocked accounts.                                                                                                                           |
| `apps/browser/src/autofill/fido2/services/browser-fido2-user-interface.service.ts`                                     | Passkey prompts accept any unlocked account.                                                                                                                     |
| `apps/browser/src/autofill/popup/fido2/fido2.component.{ts,html}`, `fido2-cipher-row.component.{ts,html}`              | Passkey popup: account labels and "Save to account" picker.                                                                                                      |
| `apps/browser/src/vault/popup/services/vault-popup-items.service.ts`                                                   | Vault list ciphers, organizations and collections come from `MultiwardenCombinedService.mergeForUsers` (all unlocked accounts in combined mode).                 |
| `apps/browser/src/vault/popup/components/vault/vault-list-items-container/*`, `vault-popup-list-table/*`               | Account badge on each row.                                                                                                                                       |
| `apps/browser/src/vault/popup/components/vault/view/*`, `add-edit/*`                                                   | Vault banner.                                                                                                                                                    |
| `apps/browser/src/auth/popup/account-switching/current-account.component.*`                                            | Header avatar is the Multiwarden account dropdown.                                                                                                               |
| `apps/browser/src/auth/popup/account-switching/account-switcher.component.*`, `account.component.ts`                   | "Combined" entry; choosing a single account leaves combined mode.                                                                                                |
| `apps/browser/src/popup/app-routing.module.ts`                                                                         | `/multiwarden-settings` route; Multiwarden guards on item and add routes.                                                                                        |
| `apps/browser/src/popup/app.component.ts`                                                                              | Calls `applyMultiwardenPopupSettings()` on start-up.                                                                                                             |
| `apps/browser/src/platform/popup/layout/popup-header.component.ts`, `popup/components/extension-anon-layout-wrapper/*` | Multiwarden logo instead of the Bitwarden logo.                                                                                                                  |
| `apps/browser/src/tools/popup/settings/settings-v2.component.html`                                                     | "Multiwarden" entry in Settings; `data-multiwarden-premium` on the Premium callout.                                                                              |
| `apps/browser/src/vault/popup/components/vault/vault.component.html`                                                   | `data-multiwarden-premium` on the Premium spotlight.                                                                                                             |
| `apps/browser/src/_locales/en/messages.json`                                                                           | `multiwarden*` strings (appended at the end). Translations live in `multiwarden/locales/` and are merged in at build time.                                       |

Branding is **not** done in upstream files: `multiwarden/scripts/brand-build.mjs` rewrites the
built extension's name, description, manifest fields and icons after the build.

## Staying in sync with upstream

Multiwarden follows Bitwarden's **released** browser extension (tags `browser-v<version>`), not
their `main` branch.

- `multiwarden/upstream-commit` holds the last upstream commit Multiwarden includes.
- `multiwarden/upstream-removed-paths` lists upstream files Multiwarden does not carry
  (Bitwarden's developer tooling and repository automation). The sync leaves them out.
- `.github/workflows/multiwarden-upstream-sync.yml` runs nightly (or on demand from the Actions
  tab, optionally with a specific version). When Bitwarden has released a newer browser
  version, it applies upstream's changes from that commit to the release tag with a 3-way merge,
  resets `release` in `multiwarden/version.json` to 1, and opens a PR on `sync/bitwarden-<version>`.
  - Clean: CI builds and tests the branch. When everything passes, the **Merge sync** job merges
    the PR and starts a release, which is then uploaded to the Chrome Web Store. Nothing to do.
  - `[conflicts]` PR: conflict markers are committed on the branch. Fix them with the hook table
    above as a guide, push, and merge. Then start a release by hand (see below).
  - CI fails on a clean PR (a test, the build or the hook check): fix it on the branch, then run
    Multiwarden CI on that branch from the Actions tab to merge it.
- Manual sync, if you prefer:

  ```bash
  git remote add upstream https://github.com/bitwarden/clients.git   # once
  git fetch upstream tag browser-v2026.12.0
  excluded=(); while read -r p; do excluded+=(":(exclude)$p"); done \
    < <(grep -v '^#' multiwarden/upstream-removed-paths | grep -v '^$')
  git diff --binary "$(cat multiwarden/upstream-commit)" browser-v2026.12.0 -- . "${excluded[@]}" \
    | git apply --3way --index
  git rev-parse "browser-v2026.12.0^{commit}" > multiwarden/upstream-commit
  ```

### Repository settings the automation needs

- **Settings → Actions → General → Workflow permissions**: tick "Allow GitHub Actions to create
  and approve pull requests" (the sync opens PRs, Merge sync merges them).
- **Settings → Branches**: a rule for `main` that requires the Multiwarden CI checks
  (`Lint and test`, `Build chrome`, `Build edge`, `Build opera`, `Build firefox`,
  `Build safari (unsigned)`) before merging, so changes go through pull requests.
- **Settings → Secrets and variables → Actions**: the Chrome Web Store secrets, see
  [store/chrome-web-store.md](store/chrome-web-store.md).

## Clients

| Client                                            | Status                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chrome, Edge, Opera, Vivaldi, Brave (Manifest V3) | Supported.                                                                                                                                                                     |
| Firefox (Manifest V2)                             | Supported. Own add-on ID `multiwarden@mteij.nl`.                                                                                                                               |
| Safari (macOS)                                    | Unsigned build, made by CI on a macOS runner (`multiwarden/scripts/package-safari-unsigned.sh`). For testing on your own Mac; a signed build needs an Apple Developer account. |
| Desktop app                                       | Next. Reuses `libs/angular/src/multiwarden`; needs a desktop `MultiwardenPlatform` and hooks in its vault screens.                                                             |
| Web vault, CLI                                    | Not started.                                                                                                                                                                   |
| Mobile                                            | Separate repositories (Kotlin/Swift); not part of this fork.                                                                                                                   |

### Installing the unsigned Safari build

1. Unzip `multiwarden-safari-unsigned-<version>.zip` and move `Multiwarden.app` to
   `/Applications`.
2. Open it once. The first time, right-click it and choose **Open** (it isn't notarized).
3. In Safari: **Settings → Advanced → Show features for web developers**, then
   **Develop → Allow Unsigned Extensions**, then turn on Multiwarden under
   **Settings → Extensions**.

Safari turns "Allow Unsigned Extensions" off whenever it quits, so step 3 repeats after each
restart. A signed and notarized build (Apple Developer account, $99/year) removes that.

## Versioning and releases

Multiwarden's version is Bitwarden's version plus a fourth number for the Multiwarden release,
for example `2026.11.0.1`. Browser stores accept four-part versions, and each one is higher than
the previous release.

When an upstream sync brings in a new Bitwarden version, the sync PR also resets `release` in
`multiwarden/version.json` to 1, so the first Multiwarden release on Bitwarden `2026.12.0` is
`2026.12.0.1`.

To release:

1. Bump `release` in `multiwarden/version.json` and commit.
2. On GitHub, open **Actions → Multiwarden CI → Run workflow**, keep the branch on `main`, tick
   **release** and run it. (Pushing a tag like `v2026.11.0.2` does the same.)
3. The workflow tests, builds every browser, creates the tag `v<version>` and publishes a GitHub
   release with one zip per browser, plus `multiwarden-source-<version>.zip` (the source package
   Firefox Add-ons asks for, with build steps in `AMO-BUILD.md`). It refuses to publish a version
   that already exists.
4. The Chrome Web Store job uploads `store-chrome-<version>.zip` and submits it for review, once
   its secrets are set ([store/chrome-web-store.md](store/chrome-web-store.md)).

Releases after an upstream sync happen automatically (see above).

The Chromium zips on GitHub contain a manifest `key`
(`multiwarden/branding/extension-key.txt`), so an unpacked install always has the ID
`geefkjbbjaipgadampajlkghfamlljll` and keeps its data when you load a newer build over it.
Store zips (`store-<browser>-<version>.zip`, CI artifacts) leave the key out, because stores
refuse it; `brand-build.mjs --store` makes them.

The build also writes `multiwarden.json` (version, Bitwarden version, upstream commit) into the
extension; Settings → Multiwarden shows it.

## Building

```bash
npm ci || npm install
cd apps/browser
NODE_ENV=production BROWSER=chrome MANIFEST_VERSION=3 npx webpack   # or edge / opera; firefox with MANIFEST_VERSION=2
cd ../..
node multiwarden/scripts/brand-build.mjs
(cd apps/browser/build && zip -qr ../../../multiwarden-chrome.zip .)
```

Only build the open-source target (`webpack`), never `build:bit:*`: those include code under
`bitwarden_license/`, which is not GPL and may not be redistributed.

To publish a release, see [Versioning and releases](#versioning-and-releases).

## Combined mode

Choose **Combined** in the header avatar's dropdown (or on the account page) to see every
unlocked account's vault at once. Bitwarden's own pages and menus act on "the active account",
so Multiwarden keeps them working by quietly making an item's account active (no sync, no
navigation) whenever you press or focus its row, open one of its pages, or pick a vault for a
new item. Combined mode stays on until you choose a single account.

## Settings (Settings → Multiwarden)

| Setting                           | Default | Effect                                                                                                                                                       |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Remember which account to save to | on      | New logins are saved to the account you last used on that site by default; you can still pick another.                                                       |
| Hide Premium notices              | off     | Hides `app-premium-badge`, `billing-premium-upgrade-nudge` and anything marked `data-multiwarden-premium`. To hide another upsell, add that attribute to it. |

## Translations

Every `multiwarden*` string is added to all of the extension's languages at build time
(`multiwarden/scripts/brand-build.mjs`): the English text first, then `multiwarden/locales/<locale>.json`
if it exists. Edit the English text in `apps/browser/src/_locales/en/messages.json` and the
translations in `multiwarden/locales/`.

## How "the active account" is handled

Bitwarden assumes one active account. Multiwarden keeps that assumption working underneath and
makes every screen say which account it uses:

| Where                                    | Account used                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vault list, search, filters, Sends       | Every unlocked account (combined view), each item with its account's avatar. Folders are named "account · folder".                                                                         |
| Item pages, fill, copy, edit, delete     | The item's own account (made active quietly first).                                                                                                                                        |
| New item / new Send                      | Asks which account (combined view).                                                                                                                                                        |
| Generator, Settings                      | The account in the account chip at the top of the page (combined view).                                                                                                                    |
| Inline menu, context menu, toolbar badge | Every unlocked account.                                                                                                                                                                    |
| Save-password prompt                     | Account picker; updates go to the login's own account.                                                                                                                                     |
| Autofill on page load                    | Configurable (Settings → Multiwarden): the account last used on the site, else only a login that is unique across all accounts (default); only unique matches; or only the active account. |

## Known limits

- Settings sub-pages (account security, vault options, ...) apply to the account shown in the
  account chip on the Settings page; extension-wide settings apply to every account anyway.
- The toolbar badge refreshes when the tab changes or the active account's vault changes; a
  change in another account's vault shows on the next tab change.
