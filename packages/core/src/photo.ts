// Encrypting photo bytes and captions with a group's symmetric key — see
// docs/ENCRYPTION.md's "what gets encrypted, and with what" table. Unlike
// group-key.ts (asymmetric, used only to hand the group key to a member),
// this is symmetric encryption of the actual content, using the group key
// every member already holds.
//
// XChaCha20-Poly1305 (the IETF construction, `crypto_aead_xchacha20poly1305_ietf_*`)
// rather than libsodium's `crypto_secretbox_*` (XSalsa20-Poly1305) — both are
// fine ciphers, XChaCha20-Poly1305 is just what docs/ENCRYPTION.md specifies.
// Its 192-bit nonce is large enough that generating one randomly per call has
// a negligible collision chance even across a huge number of photos, unlike
// shorter-nonce ciphers where random generation alone isn't safe at scale.
//
// A fresh random nonce every call is required, not optional — reusing one
// nonce for two ciphertexts under the same key breaks the cipher's
// confidentiality and integrity guarantees. This is exactly the bug caught
// while building this module: photo bytes and the caption are two separate
// ciphertexts under the same group key, so they each need their own nonce
// (`photos.nonce` and `photos.caption_nonce` — see
// docs/DECISIONS.md#separate-aead-nonce-for-the-caption).

import { fromBase64, loadSodium, toBase64 } from "./codec.js";

async function encryptBytes(
  plaintext: Uint8Array,
  groupKey: Uint8Array,
): Promise<{ ciphertext: Uint8Array; nonce: string }> {
  const s = await loadSodium();
  const nonce = s.randombytes_buf(
    s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    groupKey,
  );
  return { ciphertext, nonce: toBase64(nonce) };
}

async function decryptBytes(
  ciphertext: Uint8Array,
  nonce: string,
  groupKey: Uint8Array,
): Promise<Uint8Array> {
  const s = await loadSodium();
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      fromBase64(nonce),
      groupKey,
    );
  } catch {
    throw new Error(
      "Could not decrypt — wrong group key, wrong nonce, or corrupted data",
    );
  }
}

/**
 * Encrypts a photo's raw (already downsized, EXIF-stripped) bytes for
 * upload. Returns the ciphertext as bytes (uploaded to R2 as-is — no
 * base64, which would bloat the upload by a third) and the nonce as base64
 * (small, travels in the `POST /photos/confirm` JSON body).
 */
export async function encryptPhotoBytes(
  bytes: Uint8Array,
  groupKey: Uint8Array,
): Promise<{ ciphertext: Uint8Array; nonce: string }> {
  return encryptBytes(bytes, groupKey);
}

/**
 * Decrypts photo bytes fetched from R2 back to the original image bytes.
 */
export async function decryptPhotoBytes(
  ciphertext: Uint8Array,
  nonce: string,
  groupKey: Uint8Array,
): Promise<Uint8Array> {
  return decryptBytes(ciphertext, nonce, groupKey);
}

/**
 * Encrypts a caption string. Both the ciphertext and nonce come back as
 * base64 since a caption (unlike photo bytes) always travels as JSON, in
 * `POST /photos/confirm`'s body and in the list response.
 */
export async function encryptCaption(
  caption: string,
  groupKey: Uint8Array,
): Promise<{ ciphertext: string; nonce: string }> {
  const { ciphertext, nonce } = await encryptBytes(
    new TextEncoder().encode(caption),
    groupKey,
  );
  return { ciphertext: toBase64(ciphertext), nonce };
}

/**
 * Decrypts a caption back to plain text.
 */
export async function decryptCaption(
  ciphertext: string,
  nonce: string,
  groupKey: Uint8Array,
): Promise<string> {
  const bytes = await decryptBytes(fromBase64(ciphertext), nonce, groupKey);
  return new TextDecoder().decode(bytes);
}

/**
 * Turns decrypted photo bytes into a `data:` URI an `<Image>` component can
 * render directly — the display-side counterpart of decryptPhotoBytes.
 * Every photo this app uploads is saved as JPEG (see the mobile upload
 * pipeline), so that's the default; pass a different `mimeType` if that
 * ever changes.
 */
export async function photoBytesToDataUri(
  bytes: Uint8Array,
  mimeType = "image/jpeg",
): Promise<string> {
  return `data:${mimeType};base64,${toBase64(bytes)}`;
}
