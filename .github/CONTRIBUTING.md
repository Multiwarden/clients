# Contributing to Multiwarden

Thanks for helping out. Multiwarden is a small, independent fork of the Bitwarden browser
extension, so a few rules keep it easy to maintain and easy to update from upstream.

## Before you start

- **Bugs:** check the [open issues](https://github.com/multiwarden/clients/issues) first, then
  [open a bug report](https://github.com/multiwarden/clients/issues/new/choose).
- **Bugs that also happen in the official Bitwarden extension** belong to Bitwarden. Report them
  in [bitwarden/clients](https://github.com/bitwarden/clients/issues).
- **Security problems:** never in a public issue. See the [security policy](SECURITY.md).
- **Larger changes:** open an issue to discuss them first, so no work is wasted.

## How Multiwarden code is organised

Read the [maintainer notes](../multiwarden/README.md) before changing code. In short:

- New logic goes in Multiwarden-only files (folders named `multiwarden/`).
- Upstream Bitwarden files only get small hooks that call into that code, each marked with a
  `Multiwarden:` comment. After adding, moving or removing a hook, run
  `node multiwarden/scripts/check-hooks.mjs --update` and commit `multiwarden/hooks.json`.
- Code under `bitwarden_license/` is not used by Multiwarden. Do not import from it.
- Do not log vault data, keys or personal data, and never send unencrypted vault data anywhere.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests where it makes sense.
3. Check it:

   ```sh
   npm ci
   npm run lint
   npm test -- <path of the files you changed>
   ```

4. Open a pull request against `main` and fill in the template. CI must pass before a pull
   request is merged.

## License

Multiwarden is licensed under the [GNU GPL v3](../LICENSE_GPL.txt). By contributing, you agree
that your contribution is licensed under the same license.

## Code of conduct

Everyone taking part is expected to follow the
[code of conduct](https://github.com/multiwarden/.github/blob/main/CODE_OF_CONDUCT.md).
