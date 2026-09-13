// Per-group symmetric key — see docs/ENCRYPTION.md#2-per-group-symmetric-key
// and #3-adding-a-member for the concept. The group key itself is a plain
// random secret; this module only handles *wrapping* it for a specific
// member's public key (`crypto_box_seal`, libsodium's sealed-box
// construction — the standard "encrypt for someone's public key without
// needing a reply channel" primitive) and unwrapping it again with that
// member's private key.

import { fromBase64, loadSodium, toBase64 } from "./codec.js";

/**
 * Generates a fresh random 256-bit group key. Raw bytes — the caller keeps
 * this in memory only (it decrypts that group's photos/comments for the
 * session) and never uploads it directly, only wrapped copies.
 */
export async function generateGroupKey(): Promise<Uint8Array> {
  const s = await loadSodium();
  return s.randombytes_buf(s.crypto_secretbox_KEYBYTES);
}

/**
 * Wraps `groupKey` so only whoever holds the private key matching
 * `memberPublicKey` can read it. This is what gets uploaded to
 * `group_keys.wrapped_key` — one call per member.
 */
export async function wrapGroupKey(
  groupKey: Uint8Array,
  memberPublicKey: string,
): Promise<string> {
  const s = await loadSodium();
  const sealed = s.crypto_box_seal(groupKey, fromBase64(memberPublicKey));
  return toBase64(sealed);
}

/**
 * Unwraps a `wrapGroupKey` result using the current user's own identity
 * keypair (the same one unlocked at login — see identity.ts). Throws if the
 * keypair doesn't match or the data is corrupted.
 */
export async function unwrapGroupKey(
  wrappedKey: string,
  publicKey: string,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  const s = await loadSodium();
  try {
    return s.crypto_box_seal_open(
      fromBase64(wrappedKey),
      fromBase64(publicKey),
      privateKey,
    );
  } catch {
    throw new Error(
      "Could not unwrap group key — wrong keypair, or corrupted data",
    );
  }
}
