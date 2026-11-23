import { Utils } from "../platform/misc/utils";

/**
 * Multiwarden: an account's avatar (colour and initials) as plain values, for places that can't
 * use the `bit-avatar` component, such as the save-password bar on web pages. Mirrors the
 * component's rules (libs/components/src/avatar).
 */
export type AccountAvatar = { background: string; foreground: string; initials: string };

const DEFAULT_COLORS = [
  ["teal", "#007c95"],
  ["coral", "#c71800"],
  ["brand", "#175ddc"],
  ["green", "#008236"],
  ["purple", "#8200db"],
] as const;

function defaultColor(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length][1];
}

function initialsOf(text: string): string {
  const upper = text.toUpperCase();
  const parts = upper.split(" ").filter((p) => p.length > 0);
  if (parts.length > 1) {
    return Array.from(parts[0])[0] + Array.from(parts[1])[0];
  }
  return Array.from(upper).slice(0, 2).join("");
}

export function accountAvatar(
  userId: string,
  displayName: string,
  customColor: string | null | undefined,
): AccountAvatar {
  const named = DEFAULT_COLORS.find(([name]) => name === customColor);
  if (customColor && !named) {
    return {
      background: customColor,
      foreground: Utils.pickTextColorBasedOnBgColor(customColor, 135, true),
      initials: initialsOf(displayName),
    };
  }
  return {
    background: named ? named[1] : defaultColor(userId || displayName.toUpperCase()),
    foreground: "white",
    initials: initialsOf(displayName),
  };
}
