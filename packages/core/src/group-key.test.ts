import { describe, expect, it } from "vitest";
import { generateIdentityKeypair } from "./identity.js";
import { generateGroupKey, unwrapGroupKey, wrapGroupKey } from "./group-key.js";

describe("group key wrapping", () => {
  it("unwraps to the same key it wrapped, using the matching keypair", async () => {
    const member = await generateIdentityKeypair("member password");
    const groupKey = await generateGroupKey();

    const wrapped = await wrapGroupKey(groupKey, member.publicKey);
    const unwrapped = await unwrapGroupKey(wrapped, member.publicKey, member.privateKey);

    expect(unwrapped).toEqual(groupKey);
  });

  it("fails to unwrap with someone else's keypair", async () => {
    const member = await generateIdentityKeypair("member password");
    const someoneElse = await generateIdentityKeypair("someone else's password");
    const groupKey = await generateGroupKey();

    const wrapped = await wrapGroupKey(groupKey, member.publicKey);

    await expect(
      unwrapGroupKey(wrapped, someoneElse.publicKey, someoneElse.privateKey),
    ).rejects.toThrow(/could not unwrap/i);
  });

  it("generates a different 256-bit key every call", async () => {
    const a = await generateGroupKey();
    const b = await generateGroupKey();

    expect(a.length).toBe(32);
    expect(a).not.toEqual(b);
  });
});
