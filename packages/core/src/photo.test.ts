import { describe, expect, it } from "vitest";
import { generateGroupKey } from "./group-key.js";
import {
  decryptCaption,
  decryptPhotoBytes,
  encryptCaption,
  encryptPhotoBytes,
} from "./photo.js";

describe("photo bytes encryption", () => {
  it("decrypts back to the original bytes with the same group key", async () => {
    const groupKey = await generateGroupKey();
    const original = new Uint8Array([1, 2, 3, 4, 250, 251, 252, 253]);

    const { ciphertext, nonce } = await encryptPhotoBytes(original, groupKey);
    const decrypted = await decryptPhotoBytes(ciphertext, nonce, groupKey);

    expect(decrypted).toEqual(original);
  });

  it("fails to decrypt with the wrong group key", async () => {
    const groupKey = await generateGroupKey();
    const wrongKey = await generateGroupKey();
    const original = new Uint8Array([9, 9, 9]);

    const { ciphertext, nonce } = await encryptPhotoBytes(original, groupKey);

    await expect(
      decryptPhotoBytes(ciphertext, nonce, wrongKey),
    ).rejects.toThrow(/could not decrypt/i);
  });

  it("uses a different nonce every call, even for identical bytes", async () => {
    const groupKey = await generateGroupKey();
    const original = new Uint8Array([1, 2, 3]);

    const a = await encryptPhotoBytes(original, groupKey);
    const b = await encryptPhotoBytes(original, groupKey);

    expect(a.nonce).not.toEqual(b.nonce);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });
});

describe("caption encryption", () => {
  it("decrypts back to the original string", async () => {
    const groupKey = await generateGroupKey();
    const caption = "beach day 🌊";

    const { ciphertext, nonce } = await encryptCaption(caption, groupKey);
    const decrypted = await decryptCaption(ciphertext, nonce, groupKey);

    expect(decrypted).toBe(caption);
  });

  it("uses a nonce independent of a photo's own nonce under the same key", async () => {
    // The bug this module exists to avoid: a photo's bytes and its caption
    // are two ciphertexts under the same group key, so they must never
    // share a nonce — see docs/DECISIONS.md's "Separate AEAD nonce for the
    // caption" entry.
    const groupKey = await generateGroupKey();
    const photo = await encryptPhotoBytes(new Uint8Array([1, 2, 3]), groupKey);
    const caption = await encryptCaption("a caption", groupKey);

    expect(caption.nonce).not.toEqual(photo.nonce);
  });
});
