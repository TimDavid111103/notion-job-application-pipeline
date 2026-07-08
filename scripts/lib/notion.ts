/**
 * Notion Application Tracker — payload formatting, dedup, and row parsing (no direct API calls).
 */
import { cleanJobUrl, companyRoleKey, normalizeJobUrl, type SourcedJob } from "./job.js";

export const NOTION_DATABASE_ID = "32f1de14-69d8-803a-81ba-fb8cf47a1ccd";
export const NOTION_DATA_SOURCE_ID = "32f1de14-69d8-8016-9135-000ba274e2bd";

/** Select property — empty means no match assigned yet (options: High, Medium, Low). */
export const JOB_MATCH_PROPERTY = "Job Match";

export interface TrackerRow {
  pageId: string;
  company: string;
  role: string;
  jobUrl: string;
  jobMatch?: string;
}

export { normalizeJobUrl };

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
    Location: job.source,
    "Job URL": cleanJobUrl(job.jobUrl),
    "Date Added": isoDate,
  };
}

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
    if (companyRoleSet.has(companyRoleKey(job.company, job.role))) return false;
    return true;
  });
}

function plainText(prop: unknown): string {
  if (typeof prop === "string") return prop;
  if (!prop || typeof prop !== "object") return "";
  const arr = (prop as { rich_text?: Array<{ plain_text?: string }> }).rich_text;
  if (Array.isArray(arr)) return arr.map((t) => t.plain_text ?? "").join("");
  const title = (prop as { title?: Array<{ plain_text?: string }> }).title;
  if (Array.isArray(title)) return title.map((t) => t.plain_text ?? "").join("");
  return "";
}

function urlProp(prop: unknown): string {
  if (typeof prop === "string") return prop;
  if (!prop || typeof prop !== "object") return "";
  const url = (prop as { url?: string | null }).url;
  return url ?? "";
}

function selectProp(prop: unknown): string {
  if (typeof prop === "string") return prop;
  if (!prop || typeof prop !== "object") return "";
  const name = (prop as { select?: { name?: string } | null }).select?.name;
  return name ?? "";
}

function pageIdFromRow(row: Record<string, unknown>): string {
  const id = row.id ?? row.page_id;
  return typeof id === "string" ? id : "";
}

/** True when page markdown has no meaningful body content. */
export function isEmptyPageMarkdown(md: string): boolean {
  const trimmed = md.trim();
  if (!trimmed) return true;
  const withoutHeadings = trimmed.replace(/^#+\s*$/gm, "").trim();
  return withoutHeadings.length < 20;
}

export function parseNotionQueryResults(
  data: unknown
): Array<{ jobUrl?: string; company?: string; role?: string }> {
  return parseTrackerRows(data).map(({ jobUrl, company, role }) => ({ jobUrl, company, role }));
}

export function parseTrackerRows(data: unknown): TrackerRow[] {
  const rows = Array.isArray(data) ? data : (data as { results?: unknown[] })?.results ?? [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const props = (r.properties as Record<string, unknown> | undefined) ?? r;
    return {
      pageId: pageIdFromRow(r),
      company: plainText(props.Company),
      role: plainText(props.Role),
      jobUrl: urlProp(props["Job URL"]),
      jobMatch: selectProp(props[JOB_MATCH_PROPERTY]),
    };
  });
}

export function prepareNotionPayloads(jobs: SourcedJob[]): Array<{
  database_id: string;
  properties: NotionEntry;
}> {
  return jobs.map((job) => ({
    database_id: NOTION_DATABASE_ID,
    properties: toNotionProperties(job),
  }));
}
