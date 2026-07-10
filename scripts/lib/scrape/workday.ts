/**
 * Workday CXS (Candidate Experience Service) API helpers.
 * Public job boards expose JSON at /wday/cxs/{tenant}/{site}/job/{path}.
 */

export interface ParsedWorkdayJobUrl {
  origin: string;
  tenant: string;
  site: string;
  jobPath: string;
}

export interface WorkdayJobPosting {
  title: string;
  descriptionHtml: string;
  location: string;
  timeType: string;
  jobReqId: string;
}

const LOCALE_SEGMENT = /^\/[a-z]{2}-[A-Z]{2}\//;

export function isWorkdayJobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("myworkdayjobs.com");
  } catch {
    return false;
  }
}

/**
 * Derive CXS API coordinates from a public Workday posting URL.
 * Handles both locale-prefixed and bare site paths:
 * - …/en-US/RTS/job/ML-Engineer_R1191
 * - …/AccentureCareers/job/London/AI-Native-Engineer…
 */
export function parseWorkdayJobUrl(url: string): ParsedWorkdayJobUrl | null {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().includes("myworkdayjobs.com")) return null;

    const tenant = u.hostname.split(".")[0];
    if (!tenant) return null;

    let pathname = u.pathname.replace(/\/+$/, "");
    if (LOCALE_SEGMENT.test(pathname)) {
      pathname = pathname.replace(LOCALE_SEGMENT, "/");
    }

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length < 3) return null;

    const jobIdx = segments.indexOf("job");
    if (jobIdx < 1 || jobIdx >= segments.length - 1) return null;

    const site = segments[0]!;
    const jobPath = segments.slice(jobIdx).join("/");

    return {
      origin: u.origin,
      tenant,
      site,
      jobPath,
    };
  } catch {
    return null;
  }
}

export function buildWorkdayCxsApiUrl(parsed: ParsedWorkdayJobUrl): string {
  return `${parsed.origin}/wday/cxs/${parsed.tenant}/${parsed.site}/${parsed.jobPath}`;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Convert Workday HTML jobDescription to plain text for markdown formatting. */
export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    text = text.split(entity).join(char);
  }

  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseWorkdayApiResponse(data: unknown): WorkdayJobPosting | null {
  if (!data || typeof data !== "object") return null;
  const info = (data as Record<string, unknown>).jobPostingInfo;
  if (!info || typeof info !== "object") return null;

  const record = info as Record<string, unknown>;
  const descriptionHtml = typeof record.jobDescription === "string" ? record.jobDescription : "";
  if (!descriptionHtml.trim()) return null;

  return {
    title: typeof record.title === "string" ? record.title : "",
    descriptionHtml,
    location: typeof record.location === "string" ? record.location : "",
    timeType: typeof record.timeType === "string" ? record.timeType : "",
    jobReqId: typeof record.jobReqId === "string" ? record.jobReqId : "",
  };
}

/**
 * Fetch a Workday posting via the public CXS JSON API.
 * Returns null on parse errors, 404, or network failure.
 */
export async function fetchWorkdayJobDescription(url: string): Promise<WorkdayJobPosting | null> {
  const parsed = parseWorkdayJobUrl(url);
  if (!parsed) return null;

  const apiUrl = buildWorkdayCxsApiUrl(parsed);

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    return parseWorkdayApiResponse(data);
  } catch {
    return null;
  }
}

/** Build plain-text description from a Workday API response, including metadata lines. */
export function workdayPostingToPlainText(posting: WorkdayJobPosting): string {
  const parts: string[] = [];
  if (posting.title) parts.push(posting.title);
  if (posting.location) parts.push(`Location: ${posting.location}`);
  if (posting.timeType) parts.push(`Employment Type: ${posting.timeType}`);
  if (posting.jobReqId) parts.push(`Job Requisition ID: ${posting.jobReqId}`);

  const body = htmlToPlainText(posting.descriptionHtml);
  if (body) parts.push(body);

  return parts.join("\n\n");
}
