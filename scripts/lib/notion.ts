/**
 * Notion Application Tracker helpers — payload formatting and dedup logic.
 *
 * The agent queries Notion via MCP and calls `dedupeAgainstNotion` before logging.
 * This module does not talk to Notion directly; it prepares `notion-payloads.json`.
 */
import type { SourcedJob } from "./scratch.js";

/**
 * Application Tracker database ID.
 * User-specified data source: 32f1de14-69d8-8016-9135-000ba274e2bd (not yet shared with MCP).
 * Accessible via integration: 32f1de14-69d8-803a-81ba-fb8cf47a1ccd
 */
export const NOTION_DATABASE_ID = "32f1de14-69d8-803a-81ba-fb8cf47a1ccd";
export const NOTION_DATA_SOURCE_ID = "32f1de14-69d8-8016-9135-000ba274e2bd";

export interface NotionEntry {
  Name: string;
  Company: string;
  Role: string;
  Location: string;
  "Job URL": string;
  "Date Added": string;
}

export function toNotionProperties(job: SourcedJob, date = new Date()): NotionEntry {
  const isoDate = date.toISOString().slice(0, 10);
  return {
    Name: `${job.company}: ${job.role}`,
    Company: job.company,
    Role: job.role,
    // Location stores the aggregator source (Wobo/Handshake/Jack & Jill), not geo location.
    Location: job.source,
    "Job URL": job.jobUrl,
    "Date Added": isoDate,
  };
}

/**
 * Canonicalizes a job URL so equivalent postings compare equal:
 * - drops query string (`?utm_source=jackandjill`, tracking params) and hash
 * - lowercases host + trims trailing slash
 * - rewrites Handshake `/job-search/{id}` → `/jobs/{id}` (same posting, two paths)
 */
export function normalizeJobUrl(raw?: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    let pathname = u.pathname.replace(/\/+$/, "");
    if (/joinhandshake\.com$/i.test(u.hostname)) {
      pathname = pathname.replace(/\/job-search\/(\d+)/, "/jobs/$1");
    }
    return `${u.protocol}//${u.hostname}${pathname}`.toLowerCase();
  } catch {
    return raw.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
  }
}

const companyRoleKey = (company?: string, role?: string) =>
  `${(company ?? "").trim().toLowerCase()}::${(role ?? "").trim().toLowerCase()}`;

export function dedupeAgainstNotion(
  jobs: SourcedJob[],
  existing: Array<{ jobUrl?: string; company?: string; role?: string }>
): SourcedJob[] {
  const urlSet = new Set(existing.map((e) => normalizeJobUrl(e.jobUrl)).filter(Boolean));
  const companyRoleSet = new Set(
    existing.map((e) => companyRoleKey(e.company, e.role)).filter((k) => k !== "::")
  );

  return jobs.filter((job) => {
    const nurl = normalizeJobUrl(job.jobUrl);
    if (nurl && urlSet.has(nurl)) return false;
    // Secondary key catches URL variants we can't normalize (e.g. an ATS link
    // stored for one source vs the aggregator link for another).
    if (companyRoleSet.has(companyRoleKey(job.company, job.role))) return false;
    return true;
  });
}

/**
 * Dedup against the FULL tracker history, not just a recent window — postings
 * resurface in aggregators after 7+ days and would otherwise be re-added. The
 * tracker is small (a few hundred entries), so scanning all of it is cheap.
 * (Empty object so callers can pass it straight to query_database.)
 */
export const NOTION_DEDUP_FILTER = {};

/**
 * Prepares payloads for user-notion MCP add_database_entry calls.
 * The agent/skill invokes MCP; this module formats the data.
 */
export function prepareNotionPayloads(jobs: SourcedJob[]): Array<{
  database_id: string;
  properties: NotionEntry;
}> {
  return jobs.map((job) => ({
    database_id: NOTION_DATABASE_ID,
    properties: toNotionProperties(job),
  }));
}
