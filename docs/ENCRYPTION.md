# End-to-end encryption design

This app uses **end-to-end encryption (E2EE)**: photos and comments are
encrypted on the member's device before they ever leave it, and the server
only ever stores/moves ciphertext it cannot read. This document explains
the actual mechanism — not just "it's encrypted" — since understanding it
is part of the point of building this.

If you haven't touched public-key crypto before, read the "Concepts" section
first — the rest builds on it.

## Concepts

**Symmetric encryption** — one secret key both encrypts and decrypts. Fast,
used for the actual bulk data (photo bytes, comment text). We use
XChaCha20-Poly1305, an *AEAD* cipher (Authenticated Encryption with
Associated Data) — it doesn't just hide the data, it also detects if the
ciphertext was tampered with.

**Asymmetric (public-key) encryption** — a keypair: a *public key* you hand
out freely, and a *private key* you never share. Anything encrypted with
your public key can only be decrypted with your matching private key. Used
here for exactly one job: securely handing a symmetric key to someone
without the server ever seeing the key in the clear.

**Why both?** Asymmetric crypto is too slow/expensive to encrypt whole
photos with directly. The standard pattern (used by Signal, PGP, age, and
this app) is: encrypt the actual data with a fast symmetric key, then use
asymmetric crypto only to deliver that symmetric key to the right people.
This is often called "hybrid encryption."

**Library:** [libsodium](https://doc.libsodium.org/) via `libsodium-wrappers`
on web. It's the standard "don't roll your own crypto" choice — audited,
widely used, and its docs are unusually readable if you want to go deeper
on any primitive named below.

## The three layers of keys in this app

### 1. Per-user keypair (identity)

On first use, the client generates an X25519 keypair for that user:

- **Public key** → uploaded to the server, stored in `users.public_key`.
  Freely shareable — this is how other members will encrypt things *for*
  this user.
- **Private key** → never sent to the server in plaintext. It's encrypted
  client-side with a key derived from the user's password (via Argon2id, a
  slow "key derivation function" designed to resist brute-forcing), and
  *that* ciphertext is what gets stored server-side
  (`users.encrypted_private_key`, `users.kdf_salt`).

This means: log in on any device → client re-derives the same key from the
password → decrypts the private key locally → that device can now
participate in the group's crypto. The server holds the encrypted private
key but never the password-derived key that unlocks it, so it can never
decrypt it either. This is the same pattern password managers like
Bitwarden use for "zero-knowledge" vaults, and it's what gives us
multi-device support for free — no separate device-linking flow needed.

**Trade-off to know:** if a password reset happens without the old
password (a "forgot password" flow), the old encrypted private key becomes
unreadable — there's no way to re-derive the key that unlocked it. In a
normal app this means "lost data forever." Here it's much lower-stakes:
content is already purged within 12 hours of being shown (see
[`DECISIONS.md`](DECISIONS.md)), so the blast radius of losing key access
is at most whatever hasn't rotated out yet — not a permanent archive.

### 2. Per-group symmetric key

When a group is created, the creator's client generates a random 256-bit
key. This is the key that actually encrypts that group's photos and
comments.

The server never sees this key in plaintext — only **wrapped** (encrypted)
copies, one per member, each encrypted specifically for that member's
public key (using libsodium's `crypto_box_seal`, a sealed-box construction
built for exactly this "encrypt for someone's public key" use case):

```
group_keys(group_id, user_id, wrapped_key)
```

Each member's client fetches its own row, decrypts `wrapped_key` using its
own private key (which it already unlocked at login via step 1), and now
holds the group's symmetric key locally for the session.

### 3. Adding a member

A new member joining via invite code doesn't yet have a wrapped copy of the
group key — nobody has encrypted it for their public key yet. Some
*existing* member's client has to do that: fetch the group key it already
holds locally, wrap a fresh copy for the new member's public key, upload
it.

**Practical implication:** this can't happen purely server-side — it needs
an existing member's device to be online at some point after the join to
do the wrapping. For a friends app used async, that's a real UX detail to
design for explicitly (e.g. a "waiting for a member to let you in" state),
not a blocker, just not instant in the way a normal server-side "add row to
group_members" would be.

## What gets encrypted, and with what

| Data | Encrypted with | Where |
|---|---|---|
| Photo bytes | Group symmetric key (XChaCha20-Poly1305), random nonce per photo | Client, before upload to R2 |
| Comment text | Same group symmetric key | Client, before sending to API |
| Photo nonce | — (not secret, stored alongside ciphertext) | Postgres, on the `photos` row |

**Consequences worth naming up front:**

- **No blurhash.** A blurhash placeholder is derived from the image and
  would leak rough visual content to the server. Dropped from the Tier-2
  design — use a generic skeleton/blur loading state instead.
- **No server-side EXIF stripping backstop.** The server never sees
  plaintext bytes at all, so EXIF stripping has to happen client-side,
  before encryption, with no second chance. (Client-side stripping was
  already the plan — this just removes the server-side backstop mentioned
  in `ARCHITECTURE.md`.)
- **No server-side image processing, ever** — no thumbnails, no resizing
  on the server. Whatever size the client uploads is what everyone gets.
- **Push notification previews can't show comment content** — the server
  can't read it to put it in a notification payload. Notifications say
  "new comment," not the text.
- **No server-side content moderation is possible**, even in principle.
  Acceptable for a friends-only app; would be a real blocker if this ever
  opened up to less-trusted groups (see [`SCALING.md`](SCALING.md)).

## A nice side effect of the ephemeral design

Removing a member normally requires **key rotation with forward secrecy**:
generate a new group key, re-wrap it for remaining members, and — in a
system with permanent history — re-encrypt everything the removed member
could previously decrypt, or accept they can still decrypt old data forever.

Because nothing in this app lives longer than 12 hours, we get the
forward-secrecy property almost for free: on member removal, generate a new
group key and wrap it only for remaining members; *new* photos/comments use
the new key. The removed member can still technically decrypt whatever was
already visible to them before removal — but that's gone within 12 hours
regardless, so there's no permanent-history re-encryption problem to solve.

## Platform note: this works on web today, needs revisiting for native

`libsodium-wrappers` runs via WebAssembly, which works fine in browsers.
**React Native's default JS engine (Hermes) does not support WebAssembly**,
so this exact library won't run unmodified in the native app once that's
built. When native work starts (see [`ROADMAP.md`](ROADMAP.md)), this needs
a native-bindings crypto library instead (e.g. `react-native-sodium` or
similar) implementing the same primitives — noted here now so it doesn't
come as a surprise later.

## Data model additions (see [`ARCHITECTURE.md`](ARCHITECTURE.md) for the rest)

```
users(..., public_key, encrypted_private_key, kdf_salt)

group_keys(group_id, user_id, wrapped_key)      -- one row per member per group

photos(..., nonce)                              -- AEAD nonce for this photo's ciphertext

comments(body)                                  -- now stores ciphertext, not plaintext
```
