// Rotation timing rules — framework-free so they're testable without a
// database or a Workers runtime, and portable off Cloudflare Cron Triggers
// if the scheduler ever changes (see docs/ARCHITECTURE.md#portability-discipline).
// Everything DB-specific (does a selection already exist for today, is
// there an unshown photo to pick) lives in apps/api instead — this module
// only answers "is it time," not "what do we do about it."

// Formats `date` as the calendar date in `timeZone`, e.g. "2026-09-14".
// en-CA's built-in date format is already YYYY-MM-DD, so no manual
// zero-padding/reassembly is needed.
function localDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// hourCycle "h23" is specified explicitly because some ICU implementations
// format midnight as "24" instead of "00" under the default hour cycle for
// hour12: false — that off-by-24 would make a group with rotationHour 0
// never look due at exactly midnight.
function localHourInTimeZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

export type RotationCheck = {
  // The group's current calendar date, in its own timezone — the value a
  // new daily_selections row's local_date would use.
  localDate: string;
  // Whether the group's rotation hour has arrived for that local date.
  due: boolean;
};

// Whether `group` is due to rotate at `now`, purely as a function of its
// timezone and rotation hour — doesn't know or care whether today's
// selection has already been made (the caller checks that against
// `daily_selections` before acting on `due: true`, so a group stays "due"
// for the rest of its rotation day without this re-selecting every hour).
export function checkRotationDue(
  now: Date,
  timeZone: string,
  rotationHour: number,
): RotationCheck {
  return {
    localDate: localDateInTimeZone(now, timeZone),
    due: localHourInTimeZone(now, timeZone) >= rotationHour,
  };
}

const HOUR_MS = 60 * 60 * 1000;

// A selection's previous-day content is hard-purged 12h after it starts —
// see docs/DECISIONS.md's "Purge delay: 12 hours after the next rotation"
// entry.
export function computePurgeAfter(startsAt: Date): Date {
  return new Date(startsAt.getTime() + 12 * HOUR_MS);
}

// When this selection stops being "today's photo" — informational (drives
// the UI's "new photo coming" framing), not the purge trigger, so a fixed
// 24h offset is fine even though it can drift an hour across a DST change
// rather than tracking the group's next exact local rotation instant.
export function computeExpiresAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + 24 * HOUR_MS);
}
