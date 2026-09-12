// Per-user identity keypair — see docs/ENCRYPTION.md#1-per-user-keypair-identity
// for the concept. This module is the mechanism: generate the X25519
// keypair, and lock/unlock its private key with a key derived from the
// user's password so the server only ever stores ciphertext it can't read.

// The plain `libsodium-wrappers` build excludes Argon2id (`crypto_pwhash`)
// to keep bundle size down for callers who don't need it — this app does,
// so it needs the "sumo" build (the full libsodium API).
import sodium from "libsodium-wrappers-sumo";

export interface IdentityKeypair {
  /** X25519 public key, base64 — safe to upload as `users.public_key`. */
  publicKey: string;
  /** Password-locked private key, base64 — safe to upload as `users.encrypted_private_key`. */
  encryptedPrivateKey: string;
  /** Argon2id salt, base64 — safe to upload as `users.kdf_salt`. */
  kdfSalt: string;
}

async function loadSodium() {
  await sodium.ready;
  return sodium;
}

function toBase64(bytes: Uint8Array): string {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

function fromBase64(value: string): Uint8Array {
  return sodium.from_base64(value, sodium.base64_variants.ORIGINAL);
}

// INTERACTIVE limits (~ms-scale, not the STRONGEST/MODERATE limits meant
// for offline vaults) since this runs synchronously in the UI thread on
// every login, on phones as well as desktops. It's the same tier
// 1Password/Bitwarden use for their "unlock with password" step.
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const s = await loadSodium();
  return s.crypto_pwhash(
    s.crypto_secretbox_KEYBYTES,
    password,
    salt,
    s.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    s.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/**
 * Called once, at signup. Generates a fresh X25519 keypair and locks the
 * private key with a key derived from `password`. The three string fields
 * are what get uploaded to the server; `privateKey` is for the caller to
 * hold in memory for the current session — it must never be persisted or
 * sent anywhere in this raw form.
 */
export async function generateIdentityKeypair(
  password: string,
): Promise<IdentityKeypair & { privateKey: Uint8Array }> {
  const s = await loadSodium();

  const keypair = s.crypto_box_keypair();
  const salt = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  const derivedKey = await deriveKeyFromPassword(password, salt);

  // `users.encrypted_private_key` is a single column with no separate
  // nonce column, so the nonce travels bundled with the ciphertext:
  // [nonce (crypto_secretbox_NONCEBYTES) || ciphertext].
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const ciphertext = s.crypto_secretbox_easy(
    keypair.privateKey,
    nonce,
    derivedKey,
  );
  const bundled = new Uint8Array(nonce.length + ciphertext.length);
  bundled.set(nonce, 0);
  bundled.set(ciphertext, nonce.length);

  return {
    publicKey: toBase64(keypair.publicKey),
    encryptedPrivateKey: toBase64(bundled),
    kdfSalt: toBase64(salt),
    privateKey: keypair.privateKey,
  };
}

/**
 * Called at login (on any device): re-derives the password key and
 * decrypts the private key that was locked at signup. Throws if the
 * password is wrong or the stored data is corrupted — there is no partial
 * result to fall back to.
 */
export async function unlockIdentityKeypair(
  password: string,
  encryptedPrivateKey: string,
  kdfSalt: string,
): Promise<Uint8Array> {
  const s = await loadSodium();

  const salt = fromBase64(kdfSalt);
  const bundled = fromBase64(encryptedPrivateKey);
  const nonce = bundled.slice(0, s.crypto_secretbox_NONCEBYTES);
  const ciphertext = bundled.slice(s.crypto_secretbox_NONCEBYTES);
  const derivedKey = await deriveKeyFromPassword(password, salt);

  try {
    return s.crypto_secretbox_open_easy(ciphertext, nonce, derivedKey);
  } catch {
    throw new Error(
      "Could not unlock identity key — wrong password, or corrupted data",
    );
  }
}
