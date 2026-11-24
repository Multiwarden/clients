import versionFile from "../../../../multiwarden/version.json";

export const MULTIWARDEN_REPOSITORY = "https://github.com/multiwarden/clients";

/**
 * Multiwarden: the Multiwarden version is Bitwarden's version plus the Multiwarden release
 * number from multiwarden/version.json, for example 2026.11.1.2. The app itself keeps
 * Bitwarden's version, because Bitwarden's servers decide some features by client version.
 */
export function multiwardenVersion(bitwardenVersion: string): string {
  return `${bitwardenVersion}.${versionFile.release}`;
}
