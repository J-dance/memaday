# Open questions

Product/design questions raised during planning that haven't been settled
yet. Worth resolving before implementation starts, since a few of these
affect the data model (see [`ARCHITECTURE.md`](ARCHITECTURE.md#data-model-draft--will-change-during-implementation)).

- **Do comments vaporize with the photo, or persist as a permanent
  text-only memory?** The original brief says "deleted from everywhere,"
  which points to full vaporization — comments included. Flagging because
  it's a one-line decision now (cascade delete) and a much bigger one to
  add later (would need a "memory" concept, soft-delete only the image,
  and a UI for browsing past days). Current schema assumes comments hang
  off the daily selection and cascade-delete with it.

- **Can a photo be selected more than once**, or is upload → shown → gone
  permanent, one shot per photo? Affects whether `photos.state` needs a
  path back from `shown` to eligible again, or whether `shown`/`purged` is
  a one-way door.

- **Is screenshotting/saving the photo something we try to discourage?**
  If the ephemerality is meant to be meaningful (not just a storage-saving
  trick), that affects client UX (e.g. screenshot detection/warnings on
  native). Worth deciding intent here — this can only ever be discouraged,
  never actually prevented, on either platform.

- **What happens when a group's photo pool is empty** on rotation day —
  skip the day silently, replay an old (already-shown) photo, or push a
  reminder nudge to members to upload? Current lean in the architecture
  doc is skip + notify, not yet confirmed.

- **Expected scale** — is this a handful of friend groups, or aiming for
  broader/public use? Changes whether the hourly-cron rotation approach is
  adequate long-term (fine up to roughly tens of thousands of groups) and
  whether free-tier limits (Neon, R2, Workers) are realistic headroom or a
  near-term ceiling.

- **Exact purge delay after rotation** — how long after the new photo is
  selected does the old one get hard-deleted? Needs to be long enough that
  an in-progress comment isn't yanked mid-type, short enough that "deleted
  everywhere" still feels true. Draft assumption in the architecture doc is
  ~1 hour; not yet confirmed.
