/**
 * Versioned schemas for description-scraper runtime artifacts under `data/`.
 */
import { NOTION_DATABASE_ID } from "../notion/index.js";

export const SCRAPE_ARTIFACT_SCHEMA_VERSION = 1 as const;

export type BrokenReason =
  | "404"
  | "dns_failure"
  | "timeout"
  | "login_required"
  | "captcha"
  | "empty_content"
  | "posting_closed"
  | "navigation_error"
  | "missing_url"
  | "non_english";

const BROKEN_REASONS = new Set<string>([
  "404",
  "dns_failure",
  "timeout",
  "login_required",
  "captcha",
  "empty_content",
  "posting_closed",
  "navigation_error",
  "missing_url",
  "non_english",
]);

export interface JobsNeedingDescriptionsFile {
  schema_version: typeof SCRAPE_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  database_id: string;
  filter: {
    property: "Job Match";
    select: { is_empty: true };
  };
  row_count: number;
  results: unknown[];
}

export interface ScrapeQueueItem {
  page_id: string;
  company: string;
  role: string;
  jobUrl: string;
}

export interface ScrapeQueueFile {
  schema_version: typeof SCRAPE_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  source_snapshot: "data/jobs-needing-descriptions.json";
  item_count: number;
  items: ScrapeQueueItem[];
}

export interface ScrapeResultItem {
  page_id: string;
  company: string;
  role: string;
  jobUrl: string;
  status: "ok" | "broken";
  markdown: string | null;
  error: BrokenReason | null;
  deletable: boolean;
}

export interface ScrapeResultsSummary {
  queued: number;
  ok: number;
  broken: number;
  deletable: number;
}

export interface ScrapeResultsFile {
  schema_version: typeof SCRAPE_ARTIFACT_SCHEMA_VERSION;
  generated_at: string;
  source_queue: "data/notion-scrape-queue.json";
  summary: ScrapeResultsSummary;
  items: ScrapeResultItem[];
}

export class ScrapeArtifactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapeArtifactError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, file: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ScrapeArtifactError(`${file}: "${field}" must be a non-empty string`);
  }
  return value;
}

function requireSchemaVersion(value: unknown, file: string): typeof SCRAPE_ARTIFACT_SCHEMA_VERSION {
  if (value !== SCRAPE_ARTIFACT_SCHEMA_VERSION) {
    throw new ScrapeArtifactError(
      `${file}: unsupported schema_version ${String(value)} (expected ${SCRAPE_ARTIFACT_SCHEMA_VERSION})`
    );
  }
  return SCRAPE_ARTIFACT_SCHEMA_VERSION;
}

function rejectBareArray(raw: unknown, file: string): void {
  if (Array.isArray(raw)) {
    throw new ScrapeArtifactError(
      `${file}: bare JSON array is invalid — use the versioned object envelope (schema_version: ${SCRAPE_ARTIFACT_SCHEMA_VERSION})`
    );
  }
}

function requireIsoTimestamp(value: unknown, field: string, file: string): string {
  const ts = requireString(value, field, file);
  if (Number.isNaN(Date.parse(ts))) {
    throw new ScrapeArtifactError(`${file}: "${field}" must be an ISO-8601 timestamp`);
  }
  return ts;
}

function parseQueueItem(value: unknown, file: string, index: number): ScrapeQueueItem {
  if (!isRecord(value)) {
    throw new ScrapeArtifactError(`${file}: items[${index}] must be an object`);
  }
  return {
    page_id: requireString(value.page_id, `items[${index}].page_id`, file),
    company: requireString(value.company, `items[${index}].company`, file),
    role: requireString(value.role, `items[${index}].role`, file),
    jobUrl: requireString(value.jobUrl, `items[${index}].jobUrl`, file),
  };
}

function parseResultItem(value: unknown, file: string, index: number): ScrapeResultItem {
  if (!isRecord(value)) {
    throw new ScrapeArtifactError(`${file}: items[${index}] must be an object`);
  }

  const status = value.status;
  if (status !== "ok" && status !== "broken") {
    throw new ScrapeArtifactError(`${file}: items[${index}].status must be "ok" or "broken"`);
  }

  const markdown = value.markdown;
  if (markdown !== null && typeof markdown !== "string") {
    throw new ScrapeArtifactError(`${file}: items[${index}].markdown must be a string or null`);
  }

  const error = value.error;
  if (error !== null) {
    if (typeof error !== "string" || !BROKEN_REASONS.has(error)) {
      throw new ScrapeArtifactError(`${file}: items[${index}].error must be a known reason or null`);
    }
  }

  const deletable = value.deletable;
  if (typeof deletable !== "boolean") {
    throw new ScrapeArtifactError(`${file}: items[${index}].deletable must be a boolean`);
  }

  if (status === "ok") {
    if (!markdown) {
      throw new ScrapeArtifactError(`${file}: items[${index}] with status "ok" must include markdown`);
    }
    if (error !== null) {
      throw new ScrapeArtifactError(`${file}: items[${index}] with status "ok" must have error: null`);
    }
    if (deletable) {
      throw new ScrapeArtifactError(`${file}: items[${index}] with status "ok" must have deletable: false`);
    }
  } else {
    if (markdown !== null) {
      throw new ScrapeArtifactError(`${file}: items[${index}] with status "broken" must have markdown: null`);
    }
    if (error === null) {
      throw new ScrapeArtifactError(`${file}: items[${index}] with status "broken" must include error`);
    }
    // `deletable` is derived from the failure reason (see isDeletableFailure).
    // Transient failures (login_required, captcha) stay non-deletable so a
    // missing session never deletes a valid posting.
  }

  return {
    page_id: requireString(value.page_id, `items[${index}].page_id`, file),
    company: requireString(value.company, `items[${index}].company`, file),
    role: requireString(value.role, `items[${index}].role`, file),
    jobUrl: requireString(value.jobUrl, `items[${index}].jobUrl`, file),
    status,
    markdown,
    error: error as BrokenReason | null,
    deletable,
  };
}

export function buildJobsNeedingDescriptionsFile(results: unknown[]): JobsNeedingDescriptionsFile {
  return {
    schema_version: SCRAPE_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    database_id: NOTION_DATABASE_ID,
    filter: { property: "Job Match", select: { is_empty: true } },
    row_count: results.length,
    results,
  };
}

export function buildScrapeQueueFile(items: ScrapeQueueItem[]): ScrapeQueueFile {
  return {
    schema_version: SCRAPE_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_snapshot: "data/jobs-needing-descriptions.json",
    item_count: items.length,
    items,
  };
}

export function buildScrapeResultsFile(items: ScrapeResultItem[]): ScrapeResultsFile {
  const ok = items.filter((item) => item.status === "ok").length;
  const broken = items.filter((item) => item.status === "broken").length;
  const deletable = items.filter((item) => item.deletable).length;

  return {
    schema_version: SCRAPE_ARTIFACT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_queue: "data/notion-scrape-queue.json",
    summary: {
      queued: items.length,
      ok,
      broken,
      deletable,
    },
    items,
  };
}

export function parseJobsNeedingDescriptionsFile(
  raw: unknown,
  file = "data/jobs-needing-descriptions.json"
): JobsNeedingDescriptionsFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) {
    throw new ScrapeArtifactError(`${file}: root must be an object`);
  }

  requireSchemaVersion(raw.schema_version, file);
  requireIsoTimestamp(raw.generated_at, "generated_at", file);
  const databaseId = requireString(raw.database_id, "database_id", file);
  if (databaseId !== NOTION_DATABASE_ID) {
    throw new ScrapeArtifactError(`${file}: database_id does not match Application Tracker`);
  }

  if (!isRecord(raw.filter)) {
    throw new ScrapeArtifactError(`${file}: filter must be an object`);
  }
  if (raw.filter.property !== "Job Match") {
    throw new ScrapeArtifactError(`${file}: filter.property must be "Job Match"`);
  }
  if (!isRecord(raw.filter.select) || raw.filter.select.is_empty !== true) {
    throw new ScrapeArtifactError(`${file}: filter.select.is_empty must be true`);
  }

  if (!Array.isArray(raw.results)) {
    throw new ScrapeArtifactError(`${file}: results must be an array`);
  }
  if (typeof raw.row_count !== "number" || raw.row_count !== raw.results.length) {
    throw new ScrapeArtifactError(`${file}: row_count must equal results.length`);
  }

  return {
    schema_version: SCRAPE_ARTIFACT_SCHEMA_VERSION,
    generated_at: requireIsoTimestamp(raw.generated_at, "generated_at", file),
    database_id: databaseId,
    filter: { property: "Job Match", select: { is_empty: true } },
    row_count: raw.results.length,
    results: raw.results,
  };
}

export function parseScrapeQueueFile(
  raw: unknown,
  file = "data/notion-scrape-queue.json"
): ScrapeQueueFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) {
    throw new ScrapeArtifactError(`${file}: root must be an object`);
  }

  requireSchemaVersion(raw.schema_version, file);
  requireIsoTimestamp(raw.generated_at, "generated_at", file);
  if (raw.source_snapshot !== "data/jobs-needing-descriptions.json") {
    throw new ScrapeArtifactError(`${file}: source_snapshot must be "data/jobs-needing-descriptions.json"`);
  }
  if (!Array.isArray(raw.items)) {
    throw new ScrapeArtifactError(`${file}: items must be an array`);
  }
  if (typeof raw.item_count !== "number" || raw.item_count !== raw.items.length) {
    throw new ScrapeArtifactError(`${file}: item_count must equal items.length`);
  }

  const items = raw.items.map((item, index) => parseQueueItem(item, file, index));
  return {
    schema_version: SCRAPE_ARTIFACT_SCHEMA_VERSION,
    generated_at: requireIsoTimestamp(raw.generated_at, "generated_at", file),
    source_snapshot: "data/jobs-needing-descriptions.json",
    item_count: items.length,
    items,
  };
}

export function parseScrapeResultsFile(
  raw: unknown,
  file = "data/scrape-results.json"
): ScrapeResultsFile {
  rejectBareArray(raw, file);
  if (!isRecord(raw)) {
    throw new ScrapeArtifactError(`${file}: root must be an object`);
  }

  requireSchemaVersion(raw.schema_version, file);
  requireIsoTimestamp(raw.generated_at, "generated_at", file);
  if (raw.source_queue !== "data/notion-scrape-queue.json") {
    throw new ScrapeArtifactError(`${file}: source_queue must be "data/notion-scrape-queue.json"`);
  }
  if (!isRecord(raw.summary)) {
    throw new ScrapeArtifactError(`${file}: summary must be an object`);
  }
  if (!Array.isArray(raw.items)) {
    throw new ScrapeArtifactError(`${file}: items must be an array`);
  }

  const items = raw.items.map((item, index) => parseResultItem(item, file, index));
  const fileObj = buildScrapeResultsFile(items);
  const summary = raw.summary;
  if (!isRecord(summary)) {
    throw new ScrapeArtifactError(`${file}: summary must be an object`);
  }
  for (const key of ["queued", "ok", "broken", "deletable"] as const) {
    if (summary[key] !== fileObj.summary[key]) {
      throw new ScrapeArtifactError(`${file}: summary.${key} does not match items`);
    }
  }

  return fileObj;
}

export function serializeScrapeArtifact(file: unknown): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
