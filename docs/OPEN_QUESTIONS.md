# Open questions

Product/design questions raised during planning that haven't been settled
yet. Resolved questions have moved to [`DECISIONS.md`](DECISIONS.md).

- **What happens when a group's photo pool is empty** on rotation day —
  skip the day silently, replay an old (already-shown) photo, or push a
  reminder nudge to members to upload? Note this now interacts with the
  "select once" decision — replaying an old photo isn't on the table
  unless that decision changes, so it's really skip-silently vs.
  nudge-to-upload. Current lean in the architecture doc is skip + notify,
  not yet confirmed.
