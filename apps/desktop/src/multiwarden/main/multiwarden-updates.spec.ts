jest.mock("electron", () => ({
  app: { getVersion: () => "2026.11.0" },
  dialog: {},
  net: {},
  Notification: jest.fn(),
}));

import {
  fromUpdaterVersion,
  isNewerVersion,
  toUpdaterVersion,
  versionFromUpdateFile,
} from "./multiwarden-updates";

describe("multiwarden-updates", () => {
  it("writes the Multiwarden version as a semantic version and reads it back", () => {
    expect(toUpdaterVersion("2026.11.0.5")).toBe("2026.11.5");
    expect(toUpdaterVersion("2026.11.2.13")).toBe("2026.11.2013");
    expect(fromUpdaterVersion("2026.11.5")).toBe("2026.11.0.5");
    expect(fromUpdaterVersion("2026.11.2013")).toBe("2026.11.2.13");
  });

  it("orders Multiwarden versions part by part", () => {
    expect(isNewerVersion("2026.11.0.6", "2026.11.0.5")).toBe(true);
    expect(isNewerVersion("2026.11.1.1", "2026.11.0.9")).toBe(true);
    expect(isNewerVersion("2026.12.0.1", "2026.11.3.4")).toBe(true);
    expect(isNewerVersion("2026.11.0.5", "2026.11.0.5")).toBe(false);
    expect(isNewerVersion("2026.11.0.4", "2026.11.0.5")).toBe(false);
  });

  it("keeps the order of releases in the semantic version", () => {
    const releases = ["2026.11.0.5", "2026.11.0.12", "2026.11.1.1", "2026.12.0.1"];
    const semver = releases.map(toUpdaterVersion);
    for (let i = 1; i < releases.length; i++) {
      expect(isNewerVersion(semver[i], semver[i - 1])).toBe(true);
    }
  });

  it("reads the Multiwarden version from an update file", () => {
    const file = [
      "version: 2026.11.5",
      "files:",
      "  - url: Multiwarden-2026.11.0.5-Setup.exe",
      "path: Multiwarden-2026.11.0.5-Setup.exe",
    ].join("\n");

    expect(versionFromUpdateFile(file)).toBe("2026.11.0.5");
    expect(versionFromUpdateFile("files: []")).toBeNull();
  });
});
