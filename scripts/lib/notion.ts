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
    Location: job.source,
    "Job URL": job.jobUrl,
    "Date Added": isoDate,
  };
}

export function dedupeAgainstNotion(
  jobs: SourcedJob[],
  existing: Array<{ jobUrl?: string; company?: string; role?: string }>
): SourcedJob[] {
  const urlSet = new Set(existing.map((e) => e.jobUrl).filter(Boolean));
  const companyRoleSet = new Set(
    existing.map((e) => `${e.company?.toLowerCase()}::${e.role?.toLowerCase()}`)
  );

  return jobs.filter((job) => {
    if (job.jobUrl && urlSet.has(job.jobUrl)) return false;
    const key = `${job.company.toLowerCase()}::${job.role.toLowerCase()}`;
    if (!job.jobUrl && companyRoleSet.has(key)) return false;
    return true;
  });
}

export const NOTION_DEDUP_FILTER = {
  filter: {
    timestamp: "past_week",
    property: "Date Added",
  },
};

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
