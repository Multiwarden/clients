# Chrome Web Store listing (draft)

**Name:** Multiwarden: multi-account vaults

**Summary (max 132 chars):**
All your vaults, working as one. Unofficial fork of the Bitwarden extension: autofill, saving and passkeys across accounts.

**Category:** Productivity (or Tools)

**Description:**

All your vaults, working as one. Multiwarden lets you use your personal vault and your
work vault at the same time, from a single browser extension.

The official extension can sign in to several accounts, but only uses the one that's active.
Running two copies side by side makes them fight over autofill and save prompts. Multiwarden
keeps every unlocked account in play:

• Autofill suggestions from all unlocked accounts, labelled with the account they come from
• Save-password prompt with an account selector that remembers your choice per site
• No "save" prompt for logins you already have in any of your accounts
• Password updates saved to the account that owns the login
• Passkey sign-in across all accounts, and a choice of account when you create a passkey
• Keyboard-shortcut autofill that falls back to your other accounts

Multiwarden is open source (GPL-3.0): https://github.com/multiwarden/clients

Multiwarden is an independent project. It is not affiliated with, endorsed by, or supported by
Bitwarden, Inc. "Bitwarden" is a registered trademark of Bitwarden Inc., used here only to
describe compatibility.

**Single purpose (for the review form):**
Password manager client that autofills and saves credentials and passkeys for multiple
Bitwarden accounts simultaneously.

**Permission justifications:** reuse the upstream extension's permissions unchanged. Typical
answers:

- `tabs`, `activeTab`, `scripting`, host permissions `<all_urls>`: detect login forms and
  autofill credentials on the sites the user visits.
- `storage`, `unlimitedStorage`: store the encrypted vault locally.
- `contextMenus`: right-click autofill and password generator.
- `clipboardRead`/`clipboardWrite`, `offscreen`: copy passwords and clear the clipboard after a delay.
- `alarms`, `idle`: vault timeout (auto-lock).
- `webRequest`, `webRequestAuthProvider`: fill HTTP basic-auth prompts.
- `webNavigation`, `notifications`, `privacy`: autofill on navigation, user notices, and offering to disable the browser's built-in password manager.
- `nativeMessaging`: (only if kept in the manifest) unlock with the Bitwarden desktop app.

**Data usage disclosures:** "Authentication information" and "Personally identifiable
information" (email) are handled; not sold, not used for unrelated purposes, not used for
credit-worthiness. Privacy policy URL:
https://github.com/multiwarden/clients/blob/main/multiwarden/store/privacy-policy.md

**Store assets:** icon `multiwarden/branding/icons/store-icon128.png`. Screenshots (1280×800) are in
`store/screenshots/browser/` of [multiwarden/multiwarden](https://github.com/multiwarden/multiwarden).
