# Building Multiwarden for Firefox from this source

This archive is the complete source of the Multiwarden Firefox add-on, exactly as tagged in
https://github.com/multiwarden/clients. Multiwarden is a fork of the Bitwarden browser extension
(https://github.com/bitwarden/clients); the add-on lives in `apps/browser`, the code shared with
other Bitwarden clients in `libs/`, and Multiwarden's own changes are listed in
`multiwarden/README.md`.

## Requirements

- Linux or macOS (the official builds run on Ubuntu 24.04)
- Node.js 24.17 or newer with npm 11 (see `.nvmrc` and `engines` in `package.json`)
- `zip`
- About 8 GB of memory for webpack

## Steps

Run these from the folder this file is in:

```sh
npm ci

cd apps/browser
NODE_ENV=production BROWSER=firefox MANIFEST_VERSION=2 \
  NODE_OPTIONS=--max-old-space-size=8192 npx webpack
cd ../..

BROWSER=firefox node multiwarden/scripts/brand-build.mjs apps/browser/build --store

cd apps/browser/build
zip -qr ../../../multiwarden-firefox.zip .
```

`multiwarden-firefox.zip` then matches the submitted add-on. The only difference is the build
time stored in `multiwarden.json`.

## What the steps do

- `npx webpack` runs Bitwarden's own build of the extension (`apps/browser/webpack.config.js`).
  The code is bundled and minified with webpack and Terser. Nothing is downloaded at build time
  beyond the npm packages pinned in `package-lock.json`.
- `brand-build.mjs` changes the finished build without compiling anything. It sets the name,
  version, add-on ID and icons, and merges Multiwarden's translations from `multiwarden/locales`.
