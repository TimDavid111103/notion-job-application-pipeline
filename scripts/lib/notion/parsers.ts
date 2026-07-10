/**
 * Notion Application Tracker — row parsing helpers (no direct API calls).
 */
import {
  JOB_MATCH_PROPERTY,
  STATUS_PROPERTY,
  TERMINAL_STATUSES,
} from "./constants.js";

export interface TrackerRow {
  pageId: string;
  company: string;
  role: string;
  jobUrl: string;
  jobMatch?: string;
  status?: string;
  dateAdded?: string;
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

function dateProp(prop: unknown): string {
  if (typeof prop === "string") return prop;
  if (!prop || typeof prop !== "object") return "";
  const start = (prop as { date?: { start?: string } | null }).date?.start;
  return start ?? "";
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
      status: selectProp(props[STATUS_PROPERTY]),
      dateAdded: dateProp(props["Date Added"]),
    };
  });
}

/** True when Status is Invalid, Rejected, or Applied. */
export function isTerminalStatus(status: string | undefined): boolean {
  if (!status) return false;
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Drop rows with terminal Status even if MCP filter missed them. */
export function filterEligibleTrackerRows(rows: TrackerRow[]): TrackerRow[] {
  return rows.filter((row) => row.jobUrl.trim() && !isTerminalStatus(row.status));
}
