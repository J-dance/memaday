// `groups.invite_code` — a single reusable code per group (see
// docs/ARCHITECTURE.md's data model), not a per-invite single-use token.
// Uses the Web Crypto API (`crypto.getRandomValues`), available as a
// global in both Cloudflare Workers and Node 22+ — no extra dependency.

// Excludes visually ambiguous characters (0/O, 1/I/L) since this gets read
// aloud or typed by hand between friends.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateInviteCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // ALPHABET.length (32) divides 256 evenly, so `% ALPHABET.length` introduces no modulo bias.
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
