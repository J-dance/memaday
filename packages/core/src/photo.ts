// Photo-specific encryption helpers, built on the generic AEAD primitives
// in encryption.ts. Captions used to have their own encrypt/decrypt pair
// here too, but a caption is just text under the group key — exactly what
// a comment is — so that's now the shared `encryptText`/`decryptText` in
// encryption.ts instead of something photo.ts owns.

import { toBase64 } from "./codec.js";
import { decryptBytes, encryptBytes } from "./encryption.js";

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
