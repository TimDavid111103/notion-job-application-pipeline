/** Upper bound for inverted ms sort keys — keeps 13-digit zero-padded prefixes. */
const SORT_EPOCH_CEILING_MS = 9_999_999_999_999;

/** UTC timestamp for run logs: `2026-07-07T14-54-24Z` (no sub-second precision). */
export function formatUtcTimestamp(date = new Date()): string {
  return `${date.toISOString().slice(0, 19).replace(/:/g, "-")}Z`;
}

/**
 * Basename for a skill run log. Ascending name sort puts newest files first
 * (`0000000000000-…` is newer than `0000000001234-…`).
 */
export function runLogBasename(date = new Date(), suffix = ""): string {
  const timestamp = formatUtcTimestamp(date);
  const sortKey = String(SORT_EPOCH_CEILING_MS - date.getTime()).padStart(13, "0");
  return suffix ? `${sortKey}-${timestamp}${suffix}` : `${sortKey}-${timestamp}`;
}

export function runLogFilename(date = new Date(), suffix = ""): string {
  return `${runLogBasename(date, suffix)}.md`;
}

const LEGACY_BASENAME_RE =
  /^(?:(\d{13})-)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)(-[A-Za-z0-9-]+)?$/;

/** Parse a run-log basename (with or without sort prefix) into a Date. */
export function parseRunLogBasename(basename: string): Date | null {
  const stem = basename.replace(/\.md$/i, "");
  const match = stem.match(LEGACY_BASENAME_RE);
  if (!match) return null;
  const [, , timestamp, suffix] = match;
  void suffix;
  const iso = `${timestamp.slice(0, 10)}T${timestamp.slice(11).replace(/-/g, ":")}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Return the canonical basename when the input is legacy or already canonical. */
export function canonicalRunLogBasename(basename: string): string | null {
  const stem = basename.replace(/\.md$/i, "");
  const match = stem.match(LEGACY_BASENAME_RE);
  if (!match) return null;
  const [, sortKey, timestamp, suffix = ""] = match;
  if (sortKey) {
    const expected = runLogBasename(parseRunLogBasename(stem)!, suffix);
    return expected === stem ? stem : expected;
  }
  const date = parseRunLogBasename(stem);
  return date ? runLogBasename(date, suffix) : null;
}
