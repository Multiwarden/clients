import { multiwardenEventItemId } from "./multiwarden-vault-events";

describe("multiwardenEventItemId", () => {
  it("returns the item of a single-item event", () => {
    expect(multiwardenEventItemId({ type: "viewCipher", item: { id: "a" } })).toBe("a");
  });

  it("returns the first item of a bulk event", () => {
    expect(multiwardenEventItemId({ type: "archive", items: [{ id: "a" }, { id: "b" }] })).toBe(
      "a",
    );
  });

  it("returns the cipher of a delete event's first vault item", () => {
    expect(multiwardenEventItemId({ type: "delete", items: [{ cipher: { id: "c" } }] })).toBe("c");
  });

  it("returns undefined without an item", () => {
    expect(multiwardenEventItemId({ type: "restore", items: [] })).toBeUndefined();
  });
});
