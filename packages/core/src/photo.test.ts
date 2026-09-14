import { describe, expect, it } from "vitest";
import { generateGroupKey } from "./group-key.js";
import { decryptPhotoBytes, encryptPhotoBytes } from "./photo.js";

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
