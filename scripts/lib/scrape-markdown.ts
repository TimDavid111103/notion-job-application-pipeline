/**
 * Convert scraped posting text into readable markdown for Notion append_content.
 */

export const METADATA_LABELS = [
  "Compensation Range",
  "Compensation Structure",
  "Employment Type",
  "Location Type",
  "Department",
  "Compensation",
  "Location",
] as const;

export const SECTION_HEADINGS = [
  "About the Role",
  "About the Company",
  "The Role",
  "Key Responsibilities",
  "What You'll Do",
  "What you would do",
  "What We're Looking For",
  "Qualifications",
  "Requirements",
  "Responsibilities",
  "Benefits",
  "About you",
  "What we can offer",
  "Who we are",
  "Why Join Us",
  "Why Tennr?",
  "You're a Fit If",
  "Bonus Points If",
  "When Applying",
  "Technical Skills We Value",
  "AI and Agentic Development",
  "AI-Native Development",
  "Engineering Foundations",
  "Equal Opportunity",
  "Day to day",
] as const;

/** Section titles that commonly appear with a trailing colon in ATS text. */
export const COLON_SECTION_HEADINGS = [
  "What you would do",
  "About you",
  "What we can offer",
  "Who we are",
  "You're a Fit If",
  "Bonus Points If",
  "Why Join Us",
  "When Applying",
  "Technical Skills We Value",
  "Here's some of what the team has shipped recently",
  "Why We Exist",
] as const;

/** Sub-section titles formatted as h4 rather than h3. */
export const SUBSECTION_HEADINGS = new Set<string>([
  "Engineering Foundations",
  "AI-Native Development",
  "AI and Agentic Development",
  "Backend",
  "General",
]);

/** ATS nav tabs and other non-content headings to strip. */
export const NAV_NOISE_HEADINGS = ["Overview", "Application"] as const;

const BULLET_SECTIONS = [
  "What You'll Do",
  "What you would do",
  "What We're Looking For",
  "Key Responsibilities",
  "Qualifications",
  "Requirements",
  "Responsibilities",
  "Benefits",
  "Technical Skills We Value",
  "AI and Agentic Development",
  "AI-Native Development",
  "Engineering Foundations",
  "Here's some of what the team has shipped recently",
  "Bonus Points If",
  "Why Join Us",
] as const;

/** ATS chrome that never belongs in a job description body. */
export const FOOTER_MARKERS = [
  "Apply for this Job",
  "Quick Apply with MyGreenhouse",
  "Create a Job Alert",
  "Create alert",
  "Interested in building your career at",
  "Get future opportunities sent straight to your email",
  "Powered by Ashby",
  "Powered by Greenhouse",
] as const;

/**
 * Link labels that appear in ATS footers *and* sometimes inline in posting copy
 * (e.g. "Please see our Privacy Policy"). Only strip when preceded by footer chrome.
 */
export const FOOTER_LINK_MARKERS = [
  "Privacy Policy",
  "Security",
  "Vulnerability Disclosure",
] as const;

const FOOTER_LINK_CONTEXT_WINDOW = 160;

const ALL_BOUNDARY_LABELS = [...METADATA_LABELS, ...SECTION_HEADINGS].sort(
  (a, b) => b.length - a.length
);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function indexOfIgnoreCase(text: string, marker: string): number {
  return text.toLowerCase().indexOf(marker.toLowerCase());
}

function isFooterLinkMarker(marker: string, text: string, idx: number): boolean {
  const prefix = text.slice(Math.max(0, idx - FOOTER_LINK_CONTEXT_WINDOW), idx);
  return FOOTER_MARKERS.some((footerMarker) =>
    prefix.toLowerCase().includes(footerMarker.toLowerCase())
  );
}

/** Remove ATS footer chrome from extracted text. */
export function stripFooterContent(text: string): string {
  let cutAt = text.length;

  for (const marker of FOOTER_MARKERS) {
    const idx = indexOfIgnoreCase(text, marker);
    if (idx >= 0 && idx < cutAt) cutAt = idx;
  }

  for (const marker of FOOTER_LINK_MARKERS) {
    const idx = indexOfIgnoreCase(text, marker);
    if (idx >= 0 && idx < cutAt && isFooterLinkMarker(marker, text, idx)) {
      cutAt = idx;
    }
  }

  return text.slice(0, cutAt).trim();
}

/** Insert boundaries where ATS UIs concatenate labels and values without spaces. */
export function repairLabelBoundaries(text: string): string {
  let out = text;

  for (const label of ALL_BOUNDARY_LABELS) {
    const esc = escapeRegex(label);
    out = out.replace(new RegExp(`([a-z0-9)])(?=${esc})`, "g"), "$1\n\n");
    out = out.replace(new RegExp(`([.!?])(?=${esc})`, "g"), "$1\n\n");
  }

  for (const label of METADATA_LABELS) {
    const esc = escapeRegex(label);
    out = out.replace(new RegExp(`${esc}([A-Z#($])`, "g"), `\n\n**${label}:** $1`);
    out = out.replace(new RegExp(`\\n\\n${esc}\\s*`, "g"), `\n\n**${label}:** `);
    out = out.replace(new RegExp(`^${esc}\\s*`, "m"), `**${label}:** `);
  }

  out = out.replace(/\*\*([^*]+):\*\*(?=[^\s\n])/g, "**$1:** ");

  out = out.replace(/\b(Backend|General):([A-Z])/g, "\n\n**$1:** $2");
  out = out.replace(/([a-z])(Backend|General):/g, "$1\n\n**$2:**");
  out = out.replace(/([a-z])(GCP\/)/g, "$1\n\n$2");
  out = out.replace(/coordination(AI-driven)/g, "coordination\n\n$1");

  for (const heading of SECTION_HEADINGS) {
    const esc = escapeRegex(heading);
    out = out.replace(new RegExp(`${esc}([A-Z0-9"'(])`, "g"), `\n\n${heading}\n\n$1`);
  }

  return out;
}

/** Strip a duplicate role title heading immediately under ## Job Description. */
export function stripDuplicateTitleHeading(text: string): string {
  return text.replace(/^## ([^\n]{3,100})\n+(?=[A-Z#])/m, (match, heading) => {
    if (/^(What |About |The |Why |How |Who |Key |Bonus |When |Technical )/i.test(heading)) {
      return match;
    }
    return "";
  });
}

/** Strip ATS nav text and insert boundaries before inline About-section titles. */
export function stripNavNoiseText(text: string): string {
  return text
    .replace(/OverviewApplication/g, "\n\n")
    .replace(/([a-z])(About [A-Z])/g, "$1\n\n$2");
}

/** Break long prose into paragraphs on sentence boundaries. */
export function splitIntoParagraphs(text: string): string {
  return text
    .replace(/\)([A-Z])/g, ")\n\n$1")
    .replace(/(\d)([A-Z][a-z])/g, "$1\n\n$2")
    .replace(/([.!?])(\d)/g, "$1\n\n$2")
    .replace(/\.([a-z][a-zA-Z0-9]{1,30}) (was|is|has|are)\b/g, ".\n\n$1 $2")
    .replace(/([.!?])(\s*)(?=[A-Z"“])/g, (match, punct, _space, offset, full) => {
      const prefix = full.slice(Math.max(0, offset - 12), offset + 1);
      if (/\b(incl|e\.g|i\.e|vs|etc|dept|approx|No)\.$/i.test(prefix)) return match;
      return `${punct}\n\n`;
    });
}

/** Promote inline section titles that end with a colon. */
export function promoteColonSectionHeadings(text: string): string {
  let out = text;
  for (const heading of COLON_SECTION_HEADINGS) {
    const esc = escapeRegex(heading);
    out = out.replace(new RegExp(`\\n\\n${esc}:\\s*`, "gi"), `\n\n### ${heading}\n\n`);
    out = out.replace(new RegExp(`([.!?])\\s*${esc}:\\s*`, "gi"), `$1\n\n### ${heading}\n\n`);
    out = out.replace(new RegExp(`^${esc}:\\s*`, "gim"), `### ${heading}\n\n`);
    out = out.replace(new RegExp(`${esc}([A-Z])`, "g"), `### ${heading}\n\n$1`);
  }
  for (const heading of SUBSECTION_HEADINGS) {
    const esc = escapeRegex(heading);
    out = out.replace(new RegExp(`\\n\\n${esc}:\\s*`, "gi"), `\n\n#### ${heading}\n\n`);
    out = out.replace(new RegExp(`([.!?])\\s*${esc}:\\s*`, "gi"), `$1\n\n#### ${heading}\n\n`);
    out = out.replace(new RegExp(`^${esc}:\\s*`, "gim"), `#### ${heading}\n\n`);
  }
  return out;
}

/** Turn em-dash feature lines into bullets after colons or section headings. */
export function promoteEmDashListItems(text: string): string {
  return text.replace(/([:\n])\s*([A-Z][^\n]{8,100} – )/g, "$1\n\n- $2");
}

/** Collapse duplicated proper-noun tokens such as `AfterQueryAfterQuery`. */
export function collapseDuplicatedTokens(text: string): string {
  return text.replace(/\b([A-Z][A-Za-z0-9.®&'®-]{2,})\1\b/g, "$1");
}

/** Promote `About CompanyName` blocks when the company name is duplicated without spacing. */
export function promoteAboutHeadings(text: string): string {
  return text.replace(
    /(^|\n\n)(?!#)About ([A-Z][A-Za-z0-9.®&'®-]+?)(?=\2)/g,
    "$1### About $2\n\n$2"
  );
}

const LIST_ITEM_BREAK =
  /(?<=[a-z.)])(?=(?:Build|Design|Develop|Model|Create|Partner|Genuine|Ability|Former|Major|Lead |Own |Drive |Ship |Mentor |Talk |Guide |Help |Collaborate|Set technical|Build platform|Build AI|Write clean|Write |You're |Can |Have owned|Have strong|Comfortable |Care deeply|Not looking|Actively|Growth |Strong |Familiarity|Bias |Resourceful |Experience building|Experience verifying|Experience with|Post-revenue|Be a technical|High autonomy|Your code |Shape both|If you have|GitHub|Please send|Claude Code|AI coding|Ability to|Since |In doing|Our customers|We serve|Day to day|You've |You have|You know|You can|You'd |We don't|We want|We build|We have|We care|We value|Major plus))|(?<=YOE)(?=Major)|(?<=[a-z])(?=Collaborate)/g;

/** Split a mashed paragraph into list items when ATS text runs bullets together. */
export function splitMashedListItems(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed || trimmed.startsWith("- ")) return [trimmed];
  const parts = trimmed.split(LIST_ITEM_BREAK).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return [trimmed];
  return parts;
}

/** Promote known section titles to markdown headings. */
export function promoteSectionHeadings(text: string): string {
  let out = text;

  for (const heading of SECTION_HEADINGS) {
    const esc = escapeRegex(heading);
    out = out.replace(new RegExp(`\\n\\n${esc}\\s*\\n\\n`, "g"), `\n\n### ${heading}\n\n`);
    out = out.replace(new RegExp(`\\n\\n${esc}\\s*(?=[A-Z0-9"'(])`, "g"), `\n\n### ${heading}\n\n`);
    out = out.replace(new RegExp(`^${esc}\\s*(?=[A-Z0-9"'(])`, "m"), `### ${heading}\n\n`);
  }

  return out;
}

/** Remove ATS nav headings and fix minor formatting glitches. */
export function cleanupMarkdownNoise(text: string): string {
  let out = text;
  for (const heading of NAV_NOISE_HEADINGS) {
    const esc = escapeRegex(heading);
    out = out.replace(new RegExp(`\\n### ${esc}\\n\\n`, "g"), "\n\n");
    out = out.replace(new RegExp(`\\n${esc}\\n\\n`, "g"), "\n\n");
  }
  return out
    .replace(/\*\*([^*]+):\*\*\s*:\s*/g, "**$1:** ")
    .replace(/\*\*([^*]+):\*\*(?=[^\s\n])/g, "**$1:** ")
    .replace(/:\*\*\$/g, ":** $");
}

/** Convert paragraph blocks under list-style sections into markdown bullets. */
export function bulletizeSectionBlocks(text: string): string {
  let out = text;
  for (const section of BULLET_SECTIONS) {
    const esc = escapeRegex(section);
    const re = new RegExp(`(### ${esc}\\n\\n)([\\s\\S]*?)(?=\\n### |\\n#### |\\n## |$)`, "g");
    out = out.replace(re, (_, header: string, body: string) => {
      const items = body
        .trim()
        .split(/\n\n+/)
        .flatMap((paragraph) => {
          if (
            !paragraph ||
            paragraph.startsWith("- ") ||
            paragraph.startsWith("### ") ||
            paragraph.startsWith("#### ")
          ) {
            return [paragraph];
          }
          return splitMashedListItems(paragraph).map((item) =>
            item.startsWith("- ") ? item : `- ${item}`
          );
        })
        .filter(Boolean);
      return `${header}${items.join("\n")}\n\n`;
    });
  }
  return out;
}

/** Split inline bullet-like sentences into list items. */
export function promoteInlineBullets(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed.startsWith("**")) {
      out.push(line);
      continue;
    }

    const parts = trimmed.split(/(?<=[.!?])\s+(?=[A-Z][a-z])/);
    if (parts.length >= 3 && parts.every((part) => part.length < 220)) {
      out.push(parts.map((part) => `- ${part.trim()}`).join("\n"));
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

/** Collapse extra whitespace while preserving paragraph breaks. */
export function normalizeMarkdownWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Minimal formatting — footer strip + whitespace cleanup + heading wrapper. */
export function formatJobDescriptionPlain(body: string): string {
  let text = body.trim();
  if (!text) return "## Job Description\n\n";
  try {
    text = stripFooterContent(text);
  } catch {
    /* keep raw */
  }
  text = normalizeMarkdownWhitespace(text);
  return `## Job Description\n\n${text}`;
}

function safeFormatStep(text: string, step: (value: string) => string): string {
  try {
    const next = step(text);
    return typeof next === "string" ? next : text;
  } catch {
    return text;
  }
}

/**
 * Best-effort structured markdown. Never throws — falls back to plain text block
 * when a step fails or formatting would discard most of the extracted content.
 */
export function formatJobDescriptionMarkdown(body: string): string {
  const raw = body.trim();
  if (!raw) return "## Job Description\n\n";

  try {
    let text = raw;
    text = safeFormatStep(text, stripFooterContent);
    text = safeFormatStep(text, stripDuplicateTitleHeading);
    text = safeFormatStep(text, stripNavNoiseText);
    text = safeFormatStep(text, promoteAboutHeadings);
    text = safeFormatStep(text, collapseDuplicatedTokens);
    text = safeFormatStep(text, repairLabelBoundaries);
    text = safeFormatStep(text, promoteColonSectionHeadings);
    text = safeFormatStep(text, promoteSectionHeadings);
    text = safeFormatStep(text, cleanupMarkdownNoise);
    text = safeFormatStep(text, promoteEmDashListItems);
    text = safeFormatStep(text, splitIntoParagraphs);
    text = safeFormatStep(text, bulletizeSectionBlocks);
    text = safeFormatStep(text, promoteInlineBullets);
    text = safeFormatStep(text, normalizeMarkdownWhitespace);

    const formatted = `## Job Description\n\n${text}`;
    const bodyOut = text.trim();
    if (!bodyOut || bodyOut.length < Math.min(200, raw.length * 0.25)) {
      return formatJobDescriptionPlain(raw);
    }
    return formatted;
  } catch {
    return formatJobDescriptionPlain(raw);
  }
}

/** In-browser DOM walker — keep self-contained for page.evaluate(). */
export const EXTRACT_MARKDOWN_FROM_DOM_SOURCE = String.raw`
function __txt(el) {
  return (el && el.textContent ? el.textContent : "").replace(/\s+/g, " ").trim();
}

function __skip(el) {
  const tag = el.tagName;
  return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SVG" || tag === "BUTTON" || tag === "FORM" || tag === "NAV";
}

function __headingLevel(tag) {
  const n = parseInt(tag.slice(1), 10);
  return Number.isFinite(n) ? Math.min(n + 1, 4) : 3;
}

function __walk(node, lines) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) return;
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node;
  if (__skip(el)) return;

  const tag = el.tagName;
  if (/^H[1-6]$/.test(tag)) {
    const level = __headingLevel(tag);
    const text = __txt(el);
    if (text) lines.push("#".repeat(level) + " " + text);
    return;
  }
  if (tag === "P") {
    const text = __txt(el);
    if (text) lines.push(text);
    return;
  }
  if (tag === "LI") {
    const text = __txt(el);
    if (text) lines.push("- " + text);
    return;
  }
  if (tag === "BR") {
    lines.push("");
    return;
  }
  if (tag === "HR") {
    lines.push("---");
    return;
  }
  if (tag === "UL" || tag === "OL") {
    for (const child of el.children) __walk(child, lines);
    lines.push("");
    return;
  }

  const hasElementChildren = Array.from(el.children).some((child) => child.nodeType === Node.ELEMENT_NODE);
  if (!hasElementChildren) {
    const text = __txt(el);
    if (text.length >= 40) lines.push(text);
    return;
  }

  for (const child of el.childNodes) __walk(child, lines);
}

function __extractMarkdown(root) {
  const lines = [];
  __walk(root, lines);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

return __extractMarkdown;
`;
