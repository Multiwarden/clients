# Security policy

Multiwarden handles passwords, passkeys and vault keys, so security reports get priority over
everything else.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub instead:
[**Report a vulnerability**](https://github.com/multiwarden/clients/security/advisories/new)
(Security tab → Advisories → Report a vulnerability).

Please include:

- what an attacker can do, and under which conditions;
- the steps to reproduce it, with the Multiwarden version and browser;
- whether the official Bitwarden extension has the same problem.

You can expect a first reply within 7 days. Fixes are released as soon as they are ready, and the
advisory is published, with credit if you want it, once a fixed version is available.

## Problems that also affect Bitwarden

Multiwarden is built on Bitwarden's open-source code. If the problem is in code that Multiwarden
did not change, and the official Bitwarden extension is affected too, please report it to
Bitwarden through their [HackerOne program](https://hackerone.com/bitwarden) as well, so that it
is fixed upstream. Multiwarden picks up Bitwarden's fixes with every upstream release.

## Supported versions

Only the [latest release](https://github.com/multiwarden/clients/releases/latest) receives
security fixes.

## Scope

In scope: the Multiwarden browser extension and the code in this repository.

Out of scope: Bitwarden's servers and services, self-hosted servers, and the official Bitwarden
apps. Please do not test against accounts that are not yours.
