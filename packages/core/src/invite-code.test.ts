import { describe, expect, it } from "vitest";
import { generateInviteCode } from "./invite-code.js";

describe("invite code", () => {
  it("defaults to 8 characters from the unambiguous alphabet", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/);
  });

  it("respects a custom length", () => {
    expect(generateInviteCode(12)).toHaveLength(12);
  });

  it("is different every call", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBe(20);
  });
});
