/**
 * Per-aggregator job limits from env vars.
 * Defaults: `.cursor/skills/aggregator-sourcer/protocol/environment-variables.md`
 */
export const DEFAULT_LIMITS: Record<string, number> = {
  wobo: 30,
  handshake: 20,
  jackjill: 20,
};

const PER_AGGREGATOR_ENV: Record<string, string> = {
  wobo: "WOBO_JOB_LIMIT",
  handshake: "HANDSHAKE_JOB_LIMIT",
  jackjill: "JACKJILL_JOB_LIMIT",
};

function parseLimit(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getJobLimit(aggregator: string): number {
  const specific = parseLimit(process.env[PER_AGGREGATOR_ENV[aggregator] ?? ""]);
  if (specific !== undefined) return specific;

  const global = parseLimit(process.env.JOB_LIMIT);
  if (global !== undefined) return global;

  return DEFAULT_LIMITS[aggregator] ?? 10;
}
