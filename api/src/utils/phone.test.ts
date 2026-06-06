import { describe, it, expect } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("removes spaces", () => {
    expect(normalizePhone("+1 925 515 5725")).toBe("+19255155725");
  });

  it("removes dashes and parentheses", () => {
    expect(normalizePhone("+1 (925) 515-5725")).toBe("+19255155725");
  });

  it("removes dots", () => {
    expect(normalizePhone("+1.925.515.5725")).toBe("+19255155725");
  });

  it("preserves the leading +", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("strips non-digit non-plus characters", () => {
    expect(normalizePhone("abc+1def925ghi")).toBe("+1925");
  });

  it("handles already normalized numbers", () => {
    expect(normalizePhone("+19255155725")).toBe("+19255155725");
  });
});
