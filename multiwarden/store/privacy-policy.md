# Multiwarden privacy policy

_Last updated: 22 November 2026_

Multiwarden is a browser extension that works as a client for your Bitwarden accounts. It is an
unofficial fork of the open-source Bitwarden browser extension and is not affiliated with
Bitwarden, Inc.

## What Multiwarden handles

- **Your vault data** (logins, passkeys, cards, identities, notes). It is downloaded from, and
  saved to, the Bitwarden server you sign in to, end-to-end encrypted, exactly as in the
  upstream Bitwarden extension. Multiwarden decrypts it locally in your browser to autofill and
  save credentials.
- **Account details** (email address, server URL) for each account you sign in to, stored in
  the browser's extension storage.
- **Which account you last saved to for a site.** Multiwarden keeps this locally to pre-select
  the account in its save prompt. Sites are stored as one-way SHA-256 hashes, not as readable
  addresses.

## What Multiwarden does not do

- It does not send your data to the Multiwarden developers or to any third party. The only
  servers it talks to are the Bitwarden servers you choose (bitwarden.com, bitwarden.eu or your
  own self-hosted server), plus the icon service those servers provide if website icons are
  turned on.
- It contains no analytics, advertising or tracking code of its own.
- It does not sell or share data.

## Data from Bitwarden's services

When you use a Bitwarden-hosted server, Bitwarden, Inc. processes your account under its own
privacy policy: https://bitwarden.com/privacy/

## Removing your data

Signing out of an account removes its local data. Uninstalling the extension removes all
locally stored data. Data held on a Bitwarden server is managed through that server.

## Contact

Open an issue at https://github.com/multiwarden/clients/issues
