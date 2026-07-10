/**
 * Notion Application Tracker — payload formatting and dedup (no direct API calls).
 */
import { cleanJobUrl, companyRoleKey, normalizeJobUrl, type SourcedJob } from "../job/index.js";
import {
  IN_PROGRESS_STATUS,
  JOB_MATCH_PROPERTY,
  NOTION_DATABASE_ID,
  NOT_STARTED_STATUS,
  STATUS_PROPERTY,
} from "./constants.js";
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

/** MCP query_database filter for jobs eligible to fill. */
export function buildEligibleJobsFilter(): Record<string, unknown> {
  return {
    and: [
      { property: JOB_MATCH_PROPERTY, select: { is_not_empty: true } },
      {
        or: [
          { property: STATUS_PROPERTY, select: { is_empty: true } },
          { property: STATUS_PROPERTY, select: { equals: NOT_STARTED_STATUS } },
          { property: STATUS_PROPERTY, select: { equals: IN_PROGRESS_STATUS } },
        ],
      },
    ],
  };
}

/** MCP update_database_entry properties payload for Status changes. */
export function statusUpdatePayload(status: string): Record<string, string> {
  return { [STATUS_PROPERTY]: status };
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
