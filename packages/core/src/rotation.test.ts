import { describe, expect, it } from "vitest";
import { checkRotationDue, computeExpiresAt, computePurgeAfter } from "./rotation.js";

describe("checkRotationDue", () => {
  it("is not due before the rotation hour, in the group's own timezone", () => {
    // 2026-09-14T15:59:00Z is 08:59 in Los Angeles (UTC-7 in September).
    const now = new Date("2026-09-14T15:59:00Z");
    const result = checkRotationDue(now, "America/Los_Angeles", 9);
    expect(result.due).toBe(false);
    expect(result.localDate).toBe("2026-09-14");
  });

  it("is due once the local hour reaches the rotation hour", () => {
    // 2026-09-14T16:00:00Z is exactly 09:00 in Los Angeles.
    const now = new Date("2026-09-14T16:00:00Z");
    const result = checkRotationDue(now, "America/Los_Angeles", 9);
    expect(result.due).toBe(true);
    expect(result.localDate).toBe("2026-09-14");
  });

  it("stays due for the rest of the local day, not just the exact hour", () => {
    const now = new Date("2026-09-14T23:00:00Z"); // 16:00 in Los Angeles
    expect(checkRotationDue(now, "America/Los_Angeles", 9).due).toBe(true);
  });

  it("computes local date independently across the UTC day boundary", () => {
    // 2026-09-14T10:00:00Z is already 2026-09-14T20:00 in Auckland (UTC+10
    // in September, NZ not yet in DST) — a full 10 hours ahead of UTC's date.
    const now = new Date("2026-09-14T10:00:00Z");
    const result = checkRotationDue(now, "Pacific/Auckland", 9);
    expect(result.localDate).toBe("2026-09-14");
    expect(result.due).toBe(true);
  });

  it("handles a rotation hour of exactly midnight without an off-by-24 error", () => {
    const now = new Date("2026-09-14T07:00:00Z"); // 00:00 in Los Angeles
    const result = checkRotationDue(now, "America/Los_Angeles", 0);
    expect(result.due).toBe(true);
    expect(result.localDate).toBe("2026-09-14");
  });
});

describe("computePurgeAfter", () => {
  it("is 12 hours after the selection starts", () => {
    const startsAt = new Date("2026-09-14T16:00:00Z");
    expect(computePurgeAfter(startsAt)).toEqual(new Date("2026-09-15T04:00:00Z"));
  });
});

describe("computeExpiresAt", () => {
  it("is 24 hours after the selection starts", () => {
    const startsAt = new Date("2026-09-14T16:00:00Z");
    expect(computeExpiresAt(startsAt)).toEqual(new Date("2026-09-15T16:00:00Z"));
  });
});
