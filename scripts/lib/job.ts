/**
 * Shared job types and identity keys — used by scratch I/O, aggregators, and Notion dedup.
 */
export type JobSource = "Wobo" | "Handshake" | "Jack & Jill";

export interface SourcedJob {
  company: string;
  role: string;
  jobUrl: string;
  source: JobSource;
  location: string;
  /** ISO date (YYYY-MM-DD) when the row was sourced to scratch; set in `scratch.ts`. */
  dateSourced?: string;
}

/**
 * Canonicalizes a job URL so equivalent postings compare equal:
 * - drops query string and hash
 * - lowercases host + trims trailing slash
 * - rewrites Handshake `/job-search/{id}` → `/jobs/{id}`
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

export function companyRoleKey(company?: string, role?: string): string {
  return `${(company ?? "").trim().toLowerCase()}::${(role ?? "").trim().toLowerCase()}`;
}

/** Scratch + aggregator dedup key: normalized URL, else company+role. */
export function jobKey(job: Pick<SourcedJob, "jobUrl" | "company" | "role">): string {
  const normalized = normalizeJobUrl(job.jobUrl);
  if (normalized) return normalized;
  return companyRoleKey(job.company, job.role);
}

/** Collapse duplicate postings (first row wins). */
export function dedupeJobList(jobs: SourcedJob[]): SourcedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = jobKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
