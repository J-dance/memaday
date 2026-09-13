// Shared libsodium loading + base64 helpers used by every crypto module in
// this package (identity keys, group keys, and eventually photo/comment
// encryption) — kept in one place so they stay consistent.

// The plain `libsodium-wrappers` build excludes Argon2id (`crypto_pwhash`)
// to keep bundle size down for callers who don't need it — this app does
// (see identity.ts), so everything here uses the "sumo" build (the full
// libsodium API) for consistency, even where a given function doesn't
// itself touch Argon2id.
import sodium from "libsodium-wrappers-sumo";

export async function loadSodium() {
  await sodium.ready;
  return sodium;
}

export function toBase64(bytes: Uint8Array): string {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

export function fromBase64(value: string): Uint8Array {
  return sodium.from_base64(value, sodium.base64_variants.ORIGINAL);
}
