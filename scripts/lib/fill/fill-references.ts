/**
 * Parse fill reference markdown files and resolve form field values.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  ANSWERS_FILE,
  COVER_LETTER_MD_FILE,
  COVER_LETTER_TEMPLATE_FILE,
  PERSONAL_INFORMATION_FILE,
  PROJECTS_FILE,
  RESUME_FILE,
  SKILLS_PROFILE_FILE,
} from "../paths.js";

export interface FillContext {
  company: string;
  role: string;
  jobMatch?: string;
  /** Notion page job description markdown — required for AI-fill and cover-letter tailoring. */
  jobDescription?: string;
}

export type FillSource =
  | "personal-information.md"
  | "answers.md"
  | "projects.md"
  | "skills-profile.md"
  | "cover-letter.md"
  | "cover-letter-template.pdf"
  | "llm"
  | null;

export interface LookupResult {
  value: string;
  /** For multi-select: all option labels/values to select. */
  values?: string[];
  source: FillSource;
  confidence: "high" | "medium" | "low";
  reason?: "sensitive_manual_only" | "no_match";
}

export interface ProjectEntry {
  name: string;
  fields: Map<string, string>;
  summary: string;
  highlights: string;
}

export interface AnswerExemplar {
  theme: string;
  question: string;
  answer: string;
}

export interface SkillsProfile {
  yearsBand: string;
  proficiencyDefault: string;
  primaryTech: string[];
  secondaryTech: string[];
  outsideTech: string[];
  primarySkills: string[];
  secondarySkills: string[];
  outsideSkills: string[];
}

const SENSITIVE_PATTERNS = [
  /\bssn\b/i,
  /social\s*security/i,
  /passport/i,
  /driver'?s?\s*license/i,
  /government\s*id/i,
  /bank\s*account/i,
  /routing\s*number/i,
  /credit\s*card/i,
  /debit\s*card/i,
  /password/i,
  /pin\s*code/i,
];

const LABEL_ALIASES: Record<string, string[]> = {
  "legal first name": ["first name", "given name", "fname"],
  "legal last name": ["last name", "surname", "family name", "lname"],
  "full name": ["your name", "applicant name", "complete name"],
  "preferred name": ["preferred", "nickname", "name to be called"],
  email: ["e-mail", "email address"],
  phone: ["phone number", "mobile", "telephone", "cell"],
  "mailing address": ["address", "street address", "home address", "current address"],
  city: ["location city", "current city", "location", "preferred location", "current location"],
  "state / region": ["state", "province", "region"],
  country: ["nation"],
  linkedin: ["linkedin url", "linkedin profile"],
  github: ["github url", "github profile"],
  "portfolio url": ["portfolio link", "personal website", "personal site", "website url"],
  "current company": [
    "current employer",
    "most recent employer",
    "present company",
    "present employer",
    "employer name",
  ],
  "authorized to work in the us": ["legally authorized", "work authorization", "authorized to work"],
  "require visa sponsorship now or in future": ["sponsorship", "visa sponsorship", "require sponsorship"],
  school: ["university", "college", "institution"],
  degree: ["highest degree"],
  "graduation date": ["grad date", "expected graduation"],
  "school start date": ["university start", "start date", "education start", "attended from"],
  "school end date": ["university end", "end date", "education end", "attended to", "graduation"],
  "salary expectation": ["desired salary", "expected salary", "salary", "compensation", "pay expectation"],
  "salary currency": ["currency", "salarycurrency"],
  gender: ["sex"],
  "race / ethnicity": ["race", "ethnicity", "race or ethnicity", "race ethnicity"],
  "willing to relocate": ["relocate", "relocation", "open to relocate"],
};

/** Opaque ATS control names that are AI-fill (not auto-paste from answers.md). */
const AI_FILL_CONTROL_NAMES = new Set(["csummary", "ccoverletter"]);

const PROFICIENCY_RANK = ["expert", "advanced", "proficient", "intermediate", "beginner", "none", "n/a"];

export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[*_：:]/g, "")
    .replace(/you're/g, "you are")
    .replace(/i'm/g, "i am")
    .replace(/it's/g, "it is")
    .replace(/['']/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSensitiveField(label: string): boolean {
  const norm = normalizeLabel(label);
  return SENSITIVE_PATTERNS.some((re) => re.test(norm));
}

export function interpolate(template: string, ctx: FillContext): string {
  return template
    .replace(/\{company\}/gi, ctx.company)
    .replace(/\{role\}/gi, ctx.role)
    .replace(/\{jobMatch\}/gi, ctx.jobMatch ?? "");
}

function parseMarkdownTables(md: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = md.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---")) continue;
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length >= 2) {
      const field = normalizeLabel(cells[0]!);
      const value = cells[1]!.trim();
      if (field && value && field !== "field") map.set(field, value);
    }
  }
  return map;
}

/** Parse skills-profile.md section bullets for tech/skill matching. */
export function parseSkillsProfileStrict(md: string): SkillsProfile {
  const table = parseMarkdownTables(md);
  const yearsBand = table.get("years experience band") ?? "2-4 years";
  const proficiencyDefault = table.get("proficiency default") ?? "maximum";

  const bullets = (block: string): string[] =>
    [...block.matchAll(/^\s*[-*]\s+(.+)/gm)].map((m) => m[1]!.trim());

  const sectionAfter = (startRe: RegExp, endRe: RegExp): string => {
    const parts = md.split(startRe);
    if (parts.length < 2) return "";
    return (parts[1] ?? "").split(endRe)[0] ?? "";
  };

  const outsideBlock = md.split(/^## Outside scope/m)[1] ?? "";

  return {
    yearsBand,
    proficiencyDefault,
    primaryTech: bullets(sectionAfter(/^## Primary tech stack/m, /^## /m)),
    secondaryTech: bullets(sectionAfter(/^## Secondary tech stack/m, /^## /m)),
    outsideTech: bullets(
      (outsideBlock.split(/### Technologies outside scope/i)[1] ?? "").split(/^### /m)[0] ?? ""
    ),
    primarySkills: bullets(sectionAfter(/^## Primary skills/m, /^## /m)),
    secondarySkills: bullets(sectionAfter(/^## Secondary skills/m, /^## /m)),
    outsideSkills: [
      ...bullets((outsideBlock.split(/### Skills outside scope/i)[1] ?? "").split(/^### /m)[0] ?? ""),
      ...bullets(
        (outsideBlock.split(/### Industries outside scope/i)[1] ?? "").split(/^### /m)[0] ?? ""
      ),
    ],
  };
}

export function parsePersonalInformation(md: string): Map<string, string> {
  return parseMarkdownTables(md);
}

export function parseProjects(md: string): ProjectEntry[] {
  const entries: ProjectEntry[] = [];
  const sections = md.split(/^## /m).filter(Boolean);
  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0]?.trim() ?? "Untitled";
    const body = lines.slice(1).join("\n");
    const fields = parseMarkdownTables(body);
    const summaryMatch = body.match(/### Summary\s*\n+([\s\S]*?)(?=\n### |\n## |$)/);
    const highlightsMatch = body.match(/### Highlights\s*\n+([\s\S]*?)(?=\n### |\n## |$)/);
    entries.push({
      name,
      fields,
      summary: summaryMatch?.[1]?.trim() ?? "",
      highlights: highlightsMatch?.[1]?.trim() ?? "",
    });
  }
  return entries;
}

export function parseAnswers(md: string): AnswerExemplar[] {
  const exemplars: AnswerExemplar[] = [];
  const sections = md.split(/^## /m).filter(Boolean);
  for (const section of sections) {
    const lines = section.split("\n");
    const theme = lines[0]?.trim() ?? "";
    const body = lines.slice(1).join("\n");
    const qMatches = [...body.matchAll(/\*\*Q:\*\*\s*(.+)/g)];
    for (const qm of qMatches) {
      const question = qm[1]!.trim();
      const start = qm.index! + qm[0].length;
      const rest = body.slice(start);
      const aMatch = rest.match(/\*\*A:\*\*\s*([\s\S]*?)(?=\n\*\*Q:\*\*|$)/);
      if (aMatch) {
        exemplars.push({ theme, question, answer: aMatch[1]!.trim() });
      }
    }
  }
  return exemplars;
}

/** Whole-word / whole-phrase match so alias "state" does not hit "united states". */
function labelContainsAlias(label: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i").test(label);
}

function matchPersonalInfo(label: string, personal: Map<string, string>): string | null {
  const norm = normalizeLabel(label);

  // Unemployed / between roles → explicit N/A (do not leave ATS resume-parsed employer).
  if (/current\s*(company|employer)|present\s*(company|employer)|most\s*recent\s*employer/i.test(norm)) {
    return personal.get("current company") ?? "N/A";
  }

  // Portfolio URL fields are the GitHub link — not project essay text.
  if (/portfolio\s*(url|link)|personal\s*(website|site|url)|website\s*url/i.test(norm)) {
    return personal.get("portfolio url") ?? personal.get("github") ?? null;
  }

  // Current location / location → "City, State" (not city alone via alias).
  if (/\blocation\b/i.test(norm) && !/linkedin|github|url|timezone/i.test(norm)) {
    const city = personal.get("city");
    const state = personal.get(normalizeLabel("state / region"));
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    const mailing = personal.get("mailing address");
    if (mailing) {
      const parts = mailing.split(",").map((p) => p.trim());
      if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
      return mailing;
    }
  }

  // Salary: annual expectation lives in assets; convert when the form asks monthly.
  if (/\bsalary\b|\bcompensation\b|\bpay\b/i.test(norm)) {
    const annualRaw = personal.get("salary expectation") ?? personal.get("salary default");
    const annual = annualRaw ? Number(String(annualRaw).replace(/[^\d.]/g, "")) : NaN;
    if (Number.isFinite(annual) && annual > 0) {
      if (/\bper\s*month\b|\bmonthly\b|\/\s*mo\b/i.test(norm)) {
        return String(Math.round(annual / 12));
      }
      return String(Math.round(annual));
    }
  }

  // Workable phone helper copy used as the accessible name.
  if (/hiring team may use this number|phone number|mobile|telephone|\bphone\b/i.test(norm)) {
    return personal.get("phone") ?? null;
  }

  if (personal.has(norm)) return personal.get(norm)!;

  // Avoid matching generic "start date" / "end date" outside education context to work-history dates.
  const isEduContext =
    /school|universit|college|education|graduat|degree|attend/i.test(norm) ||
    norm.includes("school start") ||
    norm.includes("school end");

  for (const [key, aliases] of Object.entries(LABEL_ALIASES)) {
    const keyNorm = normalizeLabel(key);
    if (
      (keyNorm.includes("school start") || keyNorm.includes("school end")) &&
      !isEduContext &&
      !norm.includes("school") &&
      !norm.includes("universit")
    ) {
      // Allow exact school start/end field labels only
      if (!(norm === keyNorm || aliases.some((a) => norm === normalizeLabel(a)))) {
        continue;
      }
    }
    if (norm.includes(keyNorm) || keyNorm.includes(norm)) {
      // Avoid "portfolio url" matching a bare "portfolio" essay field.
      if (keyNorm === "portfolio url" && !/\b(url|link|website|site)\b/i.test(norm)) {
        continue;
      }
      // City aliases include "current location" — already handled above as City, State.
      if (keyNorm === "city" && /\blocation\b/i.test(norm)) continue;
      // Don't let short keys like "age" match inside longer words (e.g. "scalable").
      if (keyNorm.length <= 4 && !new RegExp(`\\b${keyNorm}\\b`, "i").test(norm)) continue;
      const val = personal.get(keyNorm);
      if (val) return val;
    }
    for (const alias of aliases) {
      if (labelContainsAlias(norm, alias)) {
        if (alias === "start date" || alias === "end date") {
          if (!isEduContext) continue;
        }
        if (keyNorm === "city" && /\blocation\b/i.test(norm)) continue;
        const val = personal.get(keyNorm);
        if (val) return val;
      }
    }
  }

  if (labelContainsAlias(norm, "full name") || norm === "name") {
    const first = personal.get("legal first name");
    const last = personal.get("legal last name");
    if (first && last) return `${first} ${last}`;
    const explicit = personal.get("full name");
    if (explicit) return explicit;
  }

  // Strict final pass — require word-boundary key match; skip very short keys.
  for (const [key, value] of personal) {
    if (key.length < 4) continue;
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(norm)) return value;
  }
  return null;
}

function isProjectField(label: string): boolean {
  const norm = normalizeLabel(label);
  // Link fields belong to personal-information (GitHub / portfolio URL), not project write-ups.
  if (/\burl\b|website|portfolio\s*link|personal\s*site/i.test(norm)) return false;
  return /project|built|github\s*repo|side\s*project|personal\s*project/i.test(norm);
}

function matchProject(label: string, projects: ProjectEntry[]): string | null {
  if (!isProjectField(label) || projects.length === 0) return null;
  const p = projects[0]!;
  const parts = [p.summary, p.highlights].filter(Boolean);
  return parts.join("\n\n") || null;
}

function fuzzyScore(a: string, b: string): number {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const aWords = new Set(na.split(/\s+/).filter((w) => w.length > 2));
  const bWords = new Set(nb.split(/\s+/).filter((w) => w.length > 2));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let hit = 0;
  for (const w of aWords) if (bWords.has(w)) hit++;
  return hit / aWords.size;
}

/** Score an exemplar against a form label using question match + theme keywords. */
export function scoreAnswerExemplar(label: string, ex: AnswerExemplar): number {
  const qScore = fuzzyScore(label, ex.question);
  const themeScore = fuzzyScore(label, ex.theme) * 0.55;
  // Light boost when theme tokens appear in the label (e.g. "evaluation", "ambiguity").
  const themeBoost = tokenOverlap(label, ex.theme) * 0.25;
  return Math.max(qScore, themeScore) + themeBoost;
}

/**
 * Rank answer seeds for a form question. Used by AI-fill prompts and lookup.
 * Prefer closest Q&A pairs over file order; diversify themes so the prompt
 * gets distinct angles instead of near-duplicates from one section.
 */
export function rankAnswerExemplars(
  label: string,
  answers: AnswerExemplar[],
  limit = 4,
  minScore = 0.25
): AnswerExemplar[] {
  const scored = answers
    .map((ex) => ({ ex, score: scoreAnswerExemplar(label, ex) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const picked: AnswerExemplar[] = [];
  const seenThemes = new Set<string>();
  // Pass 1: best hit per theme
  for (const r of scored) {
    if (picked.length >= limit) break;
    if (seenThemes.has(r.ex.theme)) continue;
    seenThemes.add(r.ex.theme);
    picked.push(r.ex);
  }
  // Pass 2: fill remaining slots with next-best (same theme ok)
  if (picked.length < limit) {
    for (const r of scored) {
      if (picked.length >= limit) break;
      if (picked.includes(r.ex)) continue;
      picked.push(r.ex);
    }
  }
  return picked;
}

function matchAnswer(label: string, answers: AnswerExemplar[], minScore = 0.4): string | null {
  const ranked = rankAnswerExemplars(label, answers, 1, minScore);
  return ranked[0]?.answer ?? null;
}

function tokenOverlap(a: string, b: string): number {
  const aw = new Set(
    normalizeLabel(a)
      .split(/[^a-z0-9+#.]+/)
      .filter((w) => w.length > 1)
  );
  const bw = normalizeLabel(b)
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 1);
  if (aw.size === 0 || bw.length === 0) return 0;
  let hit = 0;
  for (const w of bw) if (aw.has(w)) hit++;
  return hit / Math.max(bw.length, 1);
}

function techTier(option: string, skills: SkillsProfile): "primary" | "secondary" | "outside" | "unknown" {
  const norm = normalizeLabel(option);
  const hit = (list: string[]) =>
    list.some((t) => {
      const tn = normalizeLabel(t);
      return norm.includes(tn) || tn.includes(norm) || tokenOverlap(t, option) >= 0.5;
    });
  if (hit(skills.outsideTech) || hit(skills.outsideSkills)) return "outside";
  if (hit(skills.primaryTech) || hit(skills.primarySkills)) return "primary";
  if (hit(skills.secondaryTech) || hit(skills.secondarySkills)) return "secondary";

  // Keyword bridges between form options and profile phrasing
  const KEYWORDS: Array<{ re: RegExp; tier: "primary" | "secondary" | "outside" }> = [
    { re: /\brag\b|retrieval.augmented/i, tier: "primary" },
    { re: /\bagents?\b|workflows?\b|multi.agent/i, tier: "primary" },
    { re: /prompt/i, tier: "primary" },
    { re: /vector database|pgvector|weaviate|chroma/i, tier: "primary" },
    { re: /evaluat|observab|monitor|langfuse/i, tier: "primary" },
    { re: /fine.?tun/i, tier: "outside" },
    { re: /openai/i, tier: "primary" },
    { re: /anthropic/i, tier: "primary" },
    { re: /langchain/i, tier: "primary" },
    { re: /llamaindex/i, tier: "secondary" },
    { re: /pytorch|tensorflow|mlflow/i, tier: "outside" },
    { re: /docker/i, tier: "primary" },
    { re: /kubernetes/i, tier: "secondary" },
  ];
  for (const k of KEYWORDS) {
    if (k.re.test(option)) return k.tier;
  }
  return "unknown";
}

function pickYearsOption(options: string[], yearsBand: string): string | null {
  const band = normalizeLabel(yearsBand);
  const exact = options.find((o) => normalizeLabel(o) === band);
  if (exact) return exact;
  // Prefer options containing both ends of band like 2-4
  const nums = band.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 2) {
    const [lo, hi] = nums;
    const ranged = options.find((o) => {
      const n = normalizeLabel(o);
      return n.includes(`${lo}-${hi}`) || n.includes(`${lo} – ${hi}`) || n.includes(`${lo} to ${hi}`);
    });
    if (ranged) return ranged;
  }
  return options.find((o) => /2-4|2 – 4|2 to 4/i.test(o)) ?? null;
}

function pickProficiencyOption(options: string[], mode: string): string | null {
  const ranked = [...options].sort((a, b) => {
    const ra = PROFICIENCY_RANK.findIndex((p) => normalizeLabel(a).includes(p));
    const rb = PROFICIENCY_RANK.findIndex((p) => normalizeLabel(b).includes(p));
    const sa = ra === -1 ? 99 : ra;
    const sb = rb === -1 ? 99 : rb;
    return sa - sb;
  });
  if (/max/i.test(mode)) return ranked[0] ?? null;
  return ranked[0] ?? null;
}

export function matchYesNo(label: string, personal: Map<string, string>, skills: SkillsProfile): string | null {
  const norm = normalizeLabel(label);

  if (/sponsor/i.test(norm) && /without|no longer|not require/i.test(norm)) {
    // "authorized without sponsorship?" → No if we require sponsorship
    const need = personal.get("require visa sponsorship now or in future");
    if (need && /^yes$/i.test(need)) return "No";
    if (need && /^no$/i.test(need)) return "Yes";
  }
  if (/sponsor/i.test(norm)) {
    return personal.get("require visa sponsorship now or in future") ?? null;
  }
  if (/authoriz|legally authorized|work in the united states|work authorization/i.test(norm)) {
    return personal.get("authorized to work in the us") ?? null;
  }
  if (/relocat|bay area|willing to (move|relocate)|live in .*(area|city)|onsite in/i.test(norm)) {
    return personal.get("willing to relocate") ?? null;
  }
  if (/docker|kubernetes/i.test(norm)) {
    const tier = techTier("Docker", skills);
    const tierK = techTier("Kubernetes", skills);
    return tier === "primary" || tier === "secondary" || tierK === "primary" || tierK === "secondary"
      ? "Yes"
      : "No";
  }
  if (/cloud|aws|azure|gcp/i.test(norm)) {
    return techTier("AWS", skills) === "primary" || techTier("AWS", skills) === "secondary"
      ? "Yes"
      : "No";
  }
  if (/saas|startup|fast-paced/i.test(norm)) return "Yes";
  if (/autonomous|agent|multi-step reasoning|tool usage/i.test(norm)) return "Yes";
  if (/deployed ai|deploy.*ml|production/i.test(norm) && /have you/i.test(norm)) return "Yes";

  return null;
}

function fieldLooksLikeCurrencySelect(opts: string[]): boolean {
  const hit = opts.filter((o) => /dollar|euro|real|pound|yen|rupee|\$|€|£/i.test(o)).length;
  return hit >= 5;
}

function pickCurrencyOption(opts: string[], cur: string): string | null {
  const normCur = normalizeLabel(cur);
  // Strong US matches first
  const us =
    opts.find((o) => /^us\s*dollar/i.test(o.trim())) ??
    opts.find((o) => normalizeLabel(o).includes("us dollar")) ??
    opts.find((o) => /\busd\b/i.test(o) && !/brazil|real|canadian|australian|hong kong/i.test(o));
  if (/usd|us\s*dollar|\$/i.test(normCur) && us) return us;

  const exact = opts.find((o) => normalizeLabel(o) === normCur);
  if (exact) return exact;

  // Avoid bare "$" matching R$, C$, A$, etc.
  const stripped = normCur.replace(/[$\s()]/g, "");
  if (stripped && stripped !== "$") {
    const partial = opts.find((o) => {
      const on = normalizeLabel(o);
      if (/brazil|real \(r/i.test(o) && /usd|us dollar/i.test(normCur)) return false;
      return on.includes(stripped) || stripped.includes(on.replace(/[$\s()]/g, ""));
    });
    if (partial) return partial;
  }
  return us ?? null;
}

/**
 * Resolve which option(s) to pick for a select / radio / checkbox group.
 */
export function lookupChoice(
  label: string,
  options: string[],
  refs: FillReferences,
  ctx: FillContext
): LookupResult {
  if (isSensitiveField(label)) {
    return { value: "", source: null, confidence: "high", reason: "sensitive_manual_only" };
  }
  const norm = normalizeLabel(label);
  const opts = options.map((o) => o.trim()).filter(Boolean);
  if (opts.length === 0) return { value: "", source: null, confidence: "low", reason: "no_match" };

  // Privacy / consent → check affirmative
  if (/privacy|consent|ccpa|terms|agree/i.test(norm)) {
    const yes =
      opts.find((o) => /agree|consent|accept|yes|i'?ve read|i have read/i.test(o)) ??
      opts.find((o) => !/disagree|decline|no/i.test(o));
    if (yes) return { value: yes, source: "personal-information.md", confidence: "high" };
  }

  // EEO
  const gender = refs.personal.get("gender");
  if (/^gender$|gender identity|\bsex\b/i.test(norm) && gender) {
    const match =
      opts.find((o) => normalizeLabel(o) === normalizeLabel(gender)) ??
      opts.find((o) => normalizeLabel(o).includes(normalizeLabel(gender)));
    if (match) return { value: match, source: "personal-information.md", confidence: "high" };
  }
  const race = refs.personal.get("race / ethnicity");
  if (/race|ethnicity/i.test(norm) && race) {
    const rn = normalizeLabel(race);
    const match =
      opts.find((o) => normalizeLabel(o).includes("asian") && /asian|south asian/i.test(rn)) ??
      opts.find((o) => {
        const on = normalizeLabel(o);
        return on.includes(rn) || rn.includes(on.split("(")[0]!.trim());
      });
    if (match) return { value: match, source: "personal-information.md", confidence: "high" };
  }

  // Years experience
  if (/how many years|years of (hands-on )?experience|years .*experience/i.test(norm)) {
    const picked = pickYearsOption(opts, refs.skills.yearsBand);
    if (picked) return { value: picked, source: "skills-profile.md", confidence: "high" };
  }

  // Currency BEFORE tech matching — currency option lists look like multi-selects.
  if (/currency|salarycurrency/i.test(norm) || fieldLooksLikeCurrencySelect(opts)) {
    const cur = refs.personal.get("salary currency") ?? "USD ($)";
    const match = pickCurrencyOption(opts, cur);
    if (match) return { value: match, source: "personal-information.md", confidence: "high" };
  }

  // Proficiency / experience level scales
  if (/proficiency|experience level|rate your|beginner|intermediate|advanced|expert/i.test(norm)) {
    const picked = pickProficiencyOption(opts, refs.skills.proficiencyDefault);
    if (picked) return { value: picked, source: "skills-profile.md", confidence: "high" };
  }

  // Yes/No questions — always return Yes/No from personal-information even if option
  // captions are polluted (e.g. wrapping label text "Question? Yes No").
  const yn = matchYesNo(label, refs.personal, refs.skills);
  if (yn) {
    const match =
      opts.find((o) => normalizeLabel(o) === normalizeLabel(yn)) ??
      opts.find((o) => /^(yes|no)$/i.test(o.trim()) && normalizeLabel(o) === normalizeLabel(yn));
    return {
      value: match ?? yn,
      source: "personal-information.md",
      confidence: "high",
    };
  }

  // Multi-select / single-select tech lists (not years/proficiency/currency scales)
  if (
    !fieldLooksLikeCurrencySelect(opts) &&
    (/which|select all|frameworks|vector database|built or maintained|technologies|tools/i.test(norm) ||
      (opts.length >= 3 &&
        !/how many years|years of|experience level|proficiency|beginner|intermediate|advanced|expert|salary|currency/i.test(
          norm
        ) &&
        !opts.every((o) => /^(yes|no)$/i.test(o.trim()))))
  ) {
    const primaryHits: string[] = [];
    const secondaryHits: string[] = [];
    for (const opt of opts) {
      if (/none of the above|^none$/i.test(opt)) continue;
      const tier = techTier(opt, refs.skills);
      if (tier === "primary") primaryHits.push(opt);
      else if (tier === "secondary") secondaryHits.push(opt);
    }
    const selected = primaryHits.length > 0 ? primaryHits : secondaryHits;
    if (selected.length > 0) {
      return {
        value: selected[0]!,
        values: selected,
        source: "skills-profile.md",
        confidence: "high",
      };
    }
    const none = opts.find((o) => /none of the above|^none$/i.test(o));
    if (none && opts.every((o) => techTier(o, refs.skills) === "outside" || /none/i.test(o))) {
      return { value: none, source: "skills-profile.md", confidence: "medium" };
    }
  }

  // Fall back to personal / answer text match against options
  const personalVal = matchPersonalInfo(label, refs.personal);
  if (personalVal) {
    const match =
      opts.find((o) => normalizeLabel(o) === normalizeLabel(personalVal)) ??
      opts.find(
        (o) =>
          normalizeLabel(o).includes(normalizeLabel(personalVal)) ||
          normalizeLabel(personalVal).includes(normalizeLabel(o))
      );
    if (match) return { value: interpolate(match, ctx), source: "personal-information.md", confidence: "high" };
  }

  return { value: "", source: null, confidence: "low", reason: "no_match" };
}

export interface FillReferences {
  personal: Map<string, string>;
  projects: ProjectEntry[];
  answers: AnswerExemplar[];
  skills: SkillsProfile;
  resumePath: string;
  coverLetterPath: string;
  coverLetterMarkdown: string;
}

export function loadFillReferences(): FillReferences {
  const personal = parsePersonalInformation(readFileSync(PERSONAL_INFORMATION_FILE, "utf8"));
  let projects: ProjectEntry[] = [];
  let answers: AnswerExemplar[] = [];
  let skills: SkillsProfile = {
    yearsBand: "2-4 years",
    proficiencyDefault: "maximum",
    primaryTech: [],
    secondaryTech: [],
    outsideTech: [],
    primarySkills: [],
    secondarySkills: [],
    outsideSkills: [],
  };
  let coverLetterMarkdown = "";
  try {
    projects = parseProjects(readFileSync(PROJECTS_FILE, "utf8"));
  } catch {
    /* optional */
  }
  try {
    answers = parseAnswers(readFileSync(ANSWERS_FILE, "utf8"));
  } catch {
    /* optional */
  }
  try {
    skills = parseSkillsProfileStrict(readFileSync(SKILLS_PROFILE_FILE, "utf8"));
  } catch {
    /* optional */
  }
  try {
    coverLetterMarkdown = readFileSync(COVER_LETTER_MD_FILE, "utf8");
    // Drop markdown header / horizontal rules — keep letter body
    coverLetterMarkdown = coverLetterMarkdown
      .replace(/^#[\s\S]*?^---\s*/m, "")
      .trim();
  } catch {
    /* optional — PDF-only until md is added */
  }
  if (!existsSync(RESUME_FILE)) {
    throw new Error(
      `Missing resume at ${RESUME_FILE}. Copy your PDF there as resume.pdf before filling.`
    );
  }
  return {
    personal,
    projects,
    answers,
    skills,
    resumePath: RESUME_FILE,
    coverLetterPath: COVER_LETTER_TEMPLATE_FILE,
    coverLetterMarkdown,
  };
}

export function isCoverLetterField(label: string): boolean {
  return /cover\s*letter/i.test(normalizeLabel(label));
}

/** Catch-all “anything else?” fields — fill with the relevant-experience seed. */
export function isAdditionalInformationField(label: string): boolean {
  const norm = normalizeLabel(label);
  return (
    /^(additional|other|extra)\s+(information|info|comments?|details?|notes?)$/i.test(norm) ||
    /^anything else\b/i.test(norm) ||
    /^is there anything else\b/i.test(norm)
  );
}

/** Canonical answers.md question used for Additional Information aliases. */
export const RELEVANT_EXPERIENCE_QUESTION = "Please tell us about your relevant experience.";

/**
 * Map form labels to the answers.md question used for retrieval / AI-fill.
 * Additional Information → relevant experience; otherwise the label itself.
 */
export function canonicalOpenEndedQuestion(label: string): string {
  if (isAdditionalInformationField(label)) return RELEVANT_EXPERIENCE_QUESTION;
  return label;
}

/** True when answers.md ranks at least one seed for this form question (after aliases). */
export function hasAnswersBasis(label: string, answers: AnswerExemplar[], minScore = 0.35): boolean {
  const question = canonicalOpenEndedQuestion(label);
  return rankAnswerExemplars(question, answers, 1, minScore).length > 0;
}

export function isOpenEndedField(label: string, type: string): boolean {
  if (type !== "textarea" && type !== "text") return false;
  const norm = normalizeLabel(label);
  if (isCoverLetterField(norm)) return false;
  // Word boundaries — avoid "linkedin"/"name" substring false positives on long questions.
  if (
    /\b(name|email|phone|address|linkedin|github|salary|date|school|university)\b/i.test(norm)
  ) {
    return false;
  }
  return (
    isAdditionalInformationField(norm) ||
    /describe|tell us|tell me|walk me|how have|how has|how do|what (are you|experience|methods)|why |explain|challenging|experience with|open.?ended|approach|integrat|give an example|looking for|ambiguity|tradeoff|0 to 1|from scratch|worked on a team/i.test(
      norm
    ) ||
    type === "textarea"
  );
}

/** Cover letter body for textareas — template.md with last paragraph tailored to the JD. */
export function buildCoverLetterText(refs: FillReferences, ctx: FillContext): string {
  let template = refs.coverLetterMarkdown.trim();
  if (!template) {
    template = [
      `Dear ${ctx.company} Hiring Team,`,
      "",
      `I am writing to apply for the ${ctx.role} role at ${ctx.company}.`,
      "",
      "Thank you for your consideration.",
      "",
      "Sincerely,",
      refs.personal.get("full name") ?? "Applicant",
    ].join("\n");
  }

  // Drop markdown instructions above --- so only the letter body is filled/uploaded.
  const sep = template.indexOf("\n---\n");
  if (sep >= 0) template = template.slice(sep + 5).trim();
  else {
    template = template
      .replace(/^#\s.*$/gm, "")
      .replace(/^---+\s*$/gm, "")
      .trim();
  }

  const jd = ctx.jobDescription ?? "";
  const mission = extractMissionOrFocus(jd, ctx.company);
  const skills = extractRelevantSkills(jd, refs);

  const filled = template
    .replace(/\[COMPANY\]/g, ctx.company)
    .replace(/\[REFER TO MISSION STATEMENT AND\/OR CORE VALUE HERE\]/gi, mission)
    .replace(/\[RELEVANT SKILL 1\]/gi, skills[0] ?? "technical judgment")
    .replace(/\[RELEVANT SKILL 2\]/gi, skills[1] ?? "cross-functional ownership");

  if (
    /\[COMPANY\]|\[REFER TO MISSION STATEMENT AND\/OR CORE VALUE HERE\]|\[RELEVANT SKILL\s*[12]\]/i.test(
      filled
    )
  ) {
    throw new Error("Cover letter template still has unfilled placeholders after JD tailoring");
  }

  return filled;
}

function extractMissionOrFocus(jd: string, company: string): string {
  const text = jd.replace(/\s+/g, " ").trim();
  if (!text) {
    return `the work you're doing in this role and the chance to build with judgment, not just code`;
  }
  const missionHit = text.match(
    /(?:mission|vision|we believe|our goal|we're building|we are building|core values?)[:\s]+([^.]{20,180}\.)/i
  );
  if (missionHit?.[1]) return missionHit[1].trim();
  // Fall back: first substantial sentence mentioning product/customers/AI
  const sentences = text.split(/(?<=\.)\s+/).filter((s) => s.length > 40);
  const focused =
    sentences.find((s) => /mission|customer|product|ai|agent|platform|automat/i.test(s)) ??
    sentences[0];
  if (focused) return focused.replace(/^#+\s*/, "").trim().slice(0, 200);
  return `how ${company} approaches this problem space`;
}

function extractRelevantSkills(jd: string, refs: FillReferences): [string, string] {
  const jdNorm = jd.toLowerCase();
  const pool = [...refs.skills.primarySkills, ...refs.skills.primaryTech];
  const hits = pool.filter((s) => {
    const tokens = normalizeLabel(s).split(/\s+/).filter((t) => t.length > 3);
    return tokens.some((t) => jdNorm.includes(t));
  });
  const a = hits[0] ?? refs.skills.primarySkills[0] ?? "systems thinking";
  const b = hits[1] ?? refs.skills.primarySkills[1] ?? "production AI ownership";
  // Shorten long skill bullets for letter flow
  const short = (s: string) => (s.length > 60 ? s.split(",")[0]!.trim() : s);
  return [short(a), short(b)];
}

/**
 * Prefer resolveAiFill() for open-ended fields. Cover letter uses buildCoverLetterText().
 */
export function isAiFillControlName(label: string): boolean {
  return AI_FILL_CONTROL_NAMES.has(normalizeLabel(label).replace(/\s+/g, ""));
}

export function lookupField(
  label: string,
  refs: FillReferences,
  ctx: FillContext
): LookupResult {
  if (isSensitiveField(label)) {
    return {
      value: "",
      source: null,
      confidence: "high",
      reason: "sensitive_manual_only",
    };
  }

  if (isCoverLetterField(label)) {
    return {
      value: buildCoverLetterText(refs, ctx),
      source: "cover-letter.md",
      confidence: "medium",
    };
  }

  const personalVal = matchPersonalInfo(label, refs.personal);
  if (personalVal) {
    return {
      value: interpolate(personalVal, ctx),
      source: "personal-information.md",
      confidence: "high",
    };
  }

  const controlKey = normalizeLabel(label).replace(/\s+/g, "");
  // Opaque open-ended controls are AI-fill — do not auto-paste answers.md here.
  if (controlKey === "csummary") {
    return { value: "", source: null, confidence: "low", reason: "no_match" };
  }
  if (controlKey === "ccoverletter") {
    return {
      value: buildCoverLetterText(refs, ctx),
      source: "cover-letter.md",
      confidence: "medium",
    };
  }

  const answerVal = matchAnswer(label, refs.answers);
  if (answerVal) {
    return {
      value: interpolate(answerVal, ctx),
      source: "answers.md",
      confidence: "medium",
    };
  }

  const projectVal = matchProject(label, refs.projects);
  if (projectVal) {
    return {
      value: interpolate(projectVal, ctx),
      source: "projects.md",
      confidence: "medium",
    };
  }

  return {
    value: "",
    source: null,
    confidence: "low",
    reason: "no_match",
  };
}

export function getResumePath(refs: FillReferences): string {
  return refs.resumePath;
}

/** @deprecated Prefer prepareCoverLetterPdf() — never upload the static template. */
export function getCoverLetterPath(refs: FillReferences): string {
  return refs.coverLetterPath;
}

/** Convert asset dates like "Aug 2022" / "May 2026" to YYYY-MM-DD for date inputs. */
export function toDateInputValue(raw: string, boundary: "start" | "end"): string {
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw.trim();
  const my = raw.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (my) {
    const months: Record<string, string> = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const mm = months[my[1]!.toLowerCase()];
    if (mm) {
      const dd = boundary === "start" ? "01" : "28";
      return `${my[2]}-${mm}-${dd}`;
    }
  }
  return raw.trim();
}
