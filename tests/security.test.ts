import { describe, it, expect } from "vitest";
import { validSource, validAction } from "../electron/security";
import { cleanContent, isAdmin, isStaff } from "../src/lib/permissions";
describe("Input boundaries", () => {
  it("accepts only supported capture IDs", () => {
    expect(validSource("screen:0:0")).toBe(true);
    expect(validSource("window:123:0")).toBe(true);
    for (const v of [null, {}, "file:///secret", "screen:1:0;rm", "window:a:0"])
      expect(validSource(v)).toBe(false);
  });
  it("allows only three window actions", () => {
    expect(validAction("close")).toBe(true);
    expect(validAction("exec")).toBe(false);
  });
  it("rejects empty and oversized messages", () => {
    expect(() => cleanContent("  ")).toThrow();
    expect(() => cleanContent("a".repeat(4001))).toThrow();
    expect(cleanContent(" oi ")).toBe("oi");
  });
  it("does not grant captain administration", () => {
    expect(isAdmin("CAPTAIN")).toBe(false);
    expect(isStaff("MEMBER")).toBe(false);
    expect(isAdmin("OWNER")).toBe(true);
  });
});
