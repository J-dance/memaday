import { describe, expect, it } from "vitest";
import { generateGroupKey } from "./group-key.js";
import { decryptText, encryptText } from "./encryption.js";
import { encryptPhotoBytes } from "./photo.js";

describe("text encryption", () => {
  it("decrypts back to the original string", async () => {
    const groupKey = await generateGroupKey();
    const text = "beach day 🌊";

    const { ciphertext, nonce } = await encryptText(text, groupKey);
    const decrypted = await decryptText(ciphertext, nonce, groupKey);

    expect(decrypted).toBe(text);
  });

  it("fails to decrypt with the wrong group key", async () => {
    const groupKey = await generateGroupKey();
    const wrongKey = await generateGroupKey();

    const { ciphertext, nonce } = await encryptText("a comment", groupKey);

    await expect(
      decryptText(ciphertext, nonce, wrongKey),
    ).rejects.toThrow(/could not decrypt/i);
  });

  it("uses a different nonce every call, even for identical text", async () => {
    const groupKey = await generateGroupKey();

    const a = await encryptText("same text", groupKey);
    const b = await encryptText("same text", groupKey);

    expect(a.nonce).not.toEqual(b.nonce);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it("uses a nonce independent of a photo's own nonce under the same key", async () => {
    // The bug encryption.ts exists to avoid: two ciphertexts under the
    // same group key (a photo's bytes and, say, its caption or a comment)
    // must never share a nonce — see docs/DECISIONS.md's "Separate AEAD
    // nonce for the caption" entry, which generalizes to every ciphertext.
    const groupKey = await generateGroupKey();
    const photo = await encryptPhotoBytes(new Uint8Array([1, 2, 3]), groupKey);
    const text = await encryptText("a caption or comment", groupKey);

    expect(text.nonce).not.toEqual(photo.nonce);
  });
});
