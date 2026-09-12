import { describe, expect, it } from "vitest";
import { generateIdentityKeypair, unlockIdentityKeypair } from "./identity.js";

describe("identity keypair", () => {
  it("unlocks with the correct password and recovers the same private key", async () => {
    const generated = await generateIdentityKeypair("correct horse battery staple");

    const unlocked = await unlockIdentityKeypair(
      "correct horse battery staple",
      generated.encryptedPrivateKey,
      generated.kdfSalt,
    );

    expect(unlocked).toEqual(generated.privateKey);
  });

  it("rejects the wrong password", async () => {
    const generated = await generateIdentityKeypair("correct horse battery staple");

    await expect(
      unlockIdentityKeypair(
        "wrong password",
        generated.encryptedPrivateKey,
        generated.kdfSalt,
      ),
    ).rejects.toThrow(/could not unlock/i);
  });

  it("produces a different keypair and salt on every call", async () => {
    const a = await generateIdentityKeypair("same password");
    const b = await generateIdentityKeypair("same password");

    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.kdfSalt).not.toBe(b.kdfSalt);
    expect(a.encryptedPrivateKey).not.toBe(b.encryptedPrivateKey);
  });
});
