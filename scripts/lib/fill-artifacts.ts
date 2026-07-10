/**
 * Versioned schemas for application-filler runtime artifacts under `data/`.
 */
import { NOTION_DATABASE_ID, buildEligibleJobsFilter } from "./notion.js";
import type { BrokenReason } from "./scrape-artifacts.js";

export const FILL_ARTIFACT_SCHEMA_VERSION = 1 as const;

export interface JobsReadyToApplyFile {
  schema_version: typeof FILL_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  database_id: string;
  filter: ReturnType<typeof buildEligibleJobsFilter>;
  row_count: number;
  results: unknown[];
}

export interface FillQueueItem {
  page_id: string;
  company: string;
  role: string;
  jobUrl: string;
  jobMatch: string;
  dateAdded: string;
  status: string;
}

export interface FillQueueFile {
  schema_version: typeof FILL_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  source_snapshot: "data/jobs-ready-to-apply.json";
  item_count: number;
  items: FillQueueItem[];
}

export interface FillSessionFilters {
  tierFilter: string;
  dateFilter: string;
  statusFilter: string;
  sort: string;
  batchScope: string;
}

export interface FillSessionFile {
  schema_version: typeof FILL_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  filters: FillSessionFilters;
  page_ids: string[];
}

export interface UrlHealthResultItem {
  page_id: string;
  company: string;
  role: string;
  jobUrl: string;
  status: "ok" | "broken";
  error: BrokenReason | null;
  deletable: boolean;
}

export interface UrlHealthSummary {
  queued: number;
  ok: number;
  broken: number;
  deletable: number;
}

export interface UrlHealthResultsFile {
  schema_version: typeof FILL_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  source_queue: "data/notion-fill-queue.json";
  summary: UrlHealthSummary;
  items: UrlHealthResultItem[];
}

export type FillResultStatus = "filled" | "partial" | "blocked" | "broken";

export interface UnfilledField {
  label: string;
  suggestedAnswer: string | null;
  reason: "no_match" | "sensitive_manual_only" | "blocked" | "file_missing";
  source: string | null;
}

export interface FillResultItem {
  page_id: string;
  company: string;
  role: string;
  jobUrl: string;
  status: FillResultStatus;
  filledFields: string[];
  unfilledFields: UnfilledField[];
  error: BrokenReason | null;
  deletable: boolean;
}

export interface FillResultsFile {
  schema_version: typeof FILL_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  source_session: "data/fill-session.json";
  summary: {
    processed: number;
    filled: number;
    partial: number;
    blocked: number;
    broken: number;
  };
  items: FillResultItem[];
}

export class FillArtifactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FillArtifactError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, file: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new FillArtifactError(`${file}: "${field}" must be a non-empty string`);
  }
  return value;
}

function requireSchemaVersion(value: unknown, file: string): typeof FILL_ARTIFACT_SCHEMA_VERSION {
  if (value !== FILL_ARTIFACT_SCHEMA_VERSION) {
    throw new FillArtifactError(
      `${file}: unsupported schema_version ${String(value)} (expected ${FILL_ARTIFACT_SCHEMA_VERSION})`
    );
  }
  return FILL_ARTIFACT_SCHEMA_VERSION;
}

function rejectBareArray(raw: unknown, file: string): void {
  if (Array.isArray(raw)) {
    throw new FillArtifactError(
      `${file}: bare JSON array is invalid — use the versioned object envelope (schema_version: ${FILL_ARTIFACT_SCHEMA_VERSION})`
    );
  }
}

function requireIsoTimestamp(value: unknown, field: string, file: string): string {
  const ts = requireString(value, field, file);
  if (Number.isNaN(Date.parse(ts))) {
    throw new FillArtifactError(`${file}: "${field}" must be an ISO-8601 timestamp`);
  }
  return ts;
}

export function buildJobsReadyToApplyFile(results: unknown[]): JobsReadyToApplyFile {
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    database_id: NOTION_DATABASE_ID,
    filter: buildEligibleJobsFilter(),
    row_count: results.length,
    results,
  };
}

export function buildFillQueueFile(items: FillQueueItem[]): FillQueueFile {
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_snapshot: "data/jobs-ready-to-apply.json",
    item_count: items.length,
    items,
  };
}

export function buildFillSessionFile(
  pageIds: string[],
  filters: FillSessionFilters
): FillSessionFile {
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    filters,
    page_ids: pageIds,
  };
}

export function buildUrlHealthResultsFile(items: UrlHealthResultItem[]): UrlHealthResultsFile {
  const ok = items.filter((i) => i.status === "ok").length;
  const broken = items.filter((i) => i.status === "broken").length;
  const deletable = items.filter((i) => i.deletable).length;
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_queue: "data/notion-fill-queue.json",
    summary: { queued: items.length, ok, broken, deletable },
    items,
  };
}

export function buildFillResultsFile(items: FillResultItem[]): FillResultsFile {
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_session: "data/fill-session.json",
    summary: {
      processed: items.length,
      filled: items.filter((i) => i.status === "filled").length,
      partial: items.filter((i) => i.status === "partial").length,
      blocked: items.filter((i) => i.status === "blocked").length,
      broken: items.filter((i) => i.status === "broken").length,
    },
    items,
  };
}

export function parseJobsReadyToApplyFile(
  raw: unknown,
  file = "data/jobs-ready-to-apply.json"
): JobsReadyToApplyFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) throw new FillArtifactError(`${file}: root must be an object`);
  requireSchemaVersion(raw.schema_version, file);
  requireIsoTimestamp(raw.generated_at, "generated_at", file);
  const databaseId = requireString(raw.database_id, "database_id", file);
  if (databaseId !== NOTION_DATABASE_ID) {
    throw new FillArtifactError(`${file}: database_id does not match Application Tracker`);
  }
  if (!Array.isArray(raw.results)) {
    throw new FillArtifactError(`${file}: results must be an array`);
  }
  if (typeof raw.row_count !== "number" || raw.row_count !== raw.results.length) {
    throw new FillArtifactError(`${file}: row_count must equal results.length`);
  }
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: requireIsoTimestamp(raw.generated_at, "generated_at", file),
    database_id: databaseId,
    filter: buildEligibleJobsFilter(),
    row_count: raw.results.length,
    results: raw.results,
  };
}

function parseFillQueueItem(value: unknown, file: string, index: number): FillQueueItem {
  if (!isRecord(value)) throw new FillArtifactError(`${file}: items[${index}] must be an object`);
  return {
    page_id: requireString(value.page_id, `items[${index}].page_id`, file),
    company: requireString(value.company, `items[${index}].company`, file),
    role: requireString(value.role, `items[${index}].role`, file),
    jobUrl: requireString(value.jobUrl, `items[${index}].jobUrl`, file),
    jobMatch: typeof value.jobMatch === "string" ? value.jobMatch : "",
    dateAdded: typeof value.dateAdded === "string" ? value.dateAdded : "",
    status: typeof value.status === "string" ? value.status : "",
  };
}

export function parseFillQueueFile(raw: unknown, file = "data/notion-fill-queue.json"): FillQueueFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) throw new FillArtifactError(`${file}: root must be an object`);
  requireSchemaVersion(raw.schema_version, file);
  requireIsoTimestamp(raw.generated_at, "generated_at", file);
  if (raw.source_snapshot !== "data/jobs-ready-to-apply.json") {
    throw new FillArtifactError(`${file}: source_snapshot must be "data/jobs-ready-to-apply.json"`);
  }
  if (!Array.isArray(raw.items)) throw new FillArtifactError(`${file}: items must be an array`);
  const items = raw.items.map((item, i) => parseFillQueueItem(item, file, i));
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: requireIsoTimestamp(raw.generated_at, "generated_at", file),
    source_snapshot: "data/jobs-ready-to-apply.json",
    item_count: items.length,
    items,
  };
}

export function parseFillSessionFile(raw: unknown, file = "data/fill-session.json"): FillSessionFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) throw new FillArtifactError(`${file}: root must be an object`);
  requireSchemaVersion(raw.schema_version, file);
  requireIsoTimestamp(raw.generated_at, "generated_at", file);
  if (!isRecord(raw.filters)) throw new FillArtifactError(`${file}: filters must be an object`);
  if (!Array.isArray(raw.page_ids)) throw new FillArtifactError(`${file}: page_ids must be an array`);
  return {
    schema_version: FILL_ARTIFACT_SCHEMA_VERSION,
    generated_at: requireIsoTimestamp(raw.generated_at, "generated_at", file),
    filters: raw.filters as unknown as FillSessionFilters,
    page_ids: raw.page_ids.filter((id): id is string => typeof id === "string"),
  };
}

export function parseUrlHealthResultsFile(
  raw: unknown,
  file = "data/url-health-results.json"
): UrlHealthResultsFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) throw new FillArtifactError(`${file}: root must be an object`);
  requireSchemaVersion(raw.schema_version, file);
  if (!Array.isArray(raw.items)) throw new FillArtifactError(`${file}: items must be an array`);
  return buildUrlHealthResultsFile(raw.items as UrlHealthResultItem[]);
}

export function parseFillResultsFile(raw: unknown, file = "data/fill-results.json"): FillResultsFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) throw new FillArtifactError(`${file}: root must be an object`);
  requireSchemaVersion(raw.schema_version, file);
  if (!Array.isArray(raw.items)) throw new FillArtifactError(`${file}: items must be an array`);
  return buildFillResultsFile(raw.items as FillResultItem[]);
}

export function serializeFillArtifact(file: unknown): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
