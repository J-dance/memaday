// Generic symmetric encryption under a group's key — XChaCha20-Poly1305,
// shared by anything that's "encrypt this content for the group": photo
// bytes, captions, comments. See docs/ENCRYPTION.md's "what gets
// encrypted, and with what" table.
//
// XChaCha20-Poly1305 (the IETF construction, `crypto_aead_xchacha20poly1305_ietf_*`)
// rather than libsodium's `crypto_secretbox_*` (XSalsa20-Poly1305) — both are
// fine ciphers, XChaCha20-Poly1305 is just what docs/ENCRYPTION.md specifies.
// Its 192-bit nonce is large enough that generating one randomly per call has
// a negligible collision chance even across a huge number of photos/comments,
// unlike shorter-nonce ciphers where random generation alone isn't safe at
// scale.
//
// A fresh random nonce every call is required, not optional — reusing one
// nonce for two ciphertexts under the same key breaks the cipher's
// confidentiality and integrity guarantees. This is exactly the bug caught
// while building photo upload: photo bytes and the caption are two separate
// ciphertexts under the same group key, so they each need their own nonce
// (`photos.nonce` and `photos.caption_nonce` — see
// docs/DECISIONS.md#separate-aead-nonce-for-the-caption). The same applies
// to every comment: each is its own ciphertext under the same group key as
// every other comment and the photo itself, so `comments.nonce` exists for
// the same reason.

import { fromBase64, loadSodium, toBase64 } from "./codec.js";

export async function encryptBytes(
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

export async function decryptBytes(
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
 * Encrypts a plain string (a caption, a comment body — anything that's
 * just text). Both the ciphertext and nonce come back as base64 since text
 * content always travels as JSON.
 */
export async function encryptText(
  text: string,
  groupKey: Uint8Array,
): Promise<{ ciphertext: string; nonce: string }> {
  const { ciphertext, nonce } = await encryptBytes(
    new TextEncoder().encode(text),
    groupKey,
  );
  return { ciphertext: toBase64(ciphertext), nonce };
}

/**
 * Decrypts text encrypted by `encryptText` back to the original string.
 */
export async function decryptText(
  ciphertext: string,
  nonce: string,
  groupKey: Uint8Array,
): Promise<string> {
  const bytes = await decryptBytes(fromBase64(ciphertext), nonce, groupKey);
  return new TextDecoder().decode(bytes);
}
