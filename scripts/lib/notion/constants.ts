/** Notion Application Tracker — IDs and property names. */

export const NOTION_DATABASE_ID = "32f1de14-69d8-803a-81ba-fb8cf47a1ccd";
export const NOTION_DATA_SOURCE_ID = "32f1de14-69d8-8016-9135-000ba274e2bd";

/** Select property — empty means no match assigned yet (options: High, Medium, Low). */
export const JOB_MATCH_PROPERTY = "Job Match";

/** Application lifecycle select — options discovered via MCP get_database. */
export const STATUS_PROPERTY = "Status";

export const TERMINAL_STATUSES = ["Invalid", "Rejected", "Applied"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export const IN_PROGRESS_STATUS = "In Progress";
export const NOT_STARTED_STATUS = "Not Started";
