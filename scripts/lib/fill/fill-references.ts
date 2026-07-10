/**
 * Parse fill reference markdown files and resolve form field values.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  ANSWERS_FILE,
  PERSONAL_INFORMATION_FILE,
  PROJECTS_FILE,
  RESUME_FILE,
} from "../paths.js";

export interface FillContext {
  company: string;
  role: string;
  jobMatch?: string;
}

export interface LookupResult {
  value: string;
  source: "personal-information.md" | "answers.md" | "projects.md" | null;
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
  "preferred name": ["preferred", "nickname", "name to be called"],
  email: ["e-mail", "email address"],
  phone: ["phone number", "mobile", "telephone", "cell"],
  city: ["location city", "current city"],
  "state / region": ["state", "province", "region"],
  country: ["nation"],
  linkedin: ["linkedin url", "linkedin profile"],
  github: ["github url", "github profile"],
  "authorized to work in the us": ["legally authorized", "work authorization", "authorized to work"],
  "require visa sponsorship now or in future": ["sponsorship", "visa sponsorship", "require sponsorship"],
  school: ["university", "college", "institution"],
  degree: ["highest degree"],
  "graduation date": ["grad date", "expected graduation"],
};

export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[*_]/g, "")
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

function matchPersonalInfo(label: string, personal: Map<string, string>): string | null {
  const norm = normalizeLabel(label);
  if (personal.has(norm)) return personal.get(norm)!;

  for (const [key, aliases] of Object.entries(LABEL_ALIASES)) {
    const keyNorm = normalizeLabel(key);
    if (norm.includes(keyNorm) || keyNorm.includes(norm)) {
      const val = personal.get(keyNorm);
      if (val) return val;
    }
    for (const alias of aliases) {
      if (norm.includes(alias) || alias.includes(norm)) {
        const val = personal.get(keyNorm);
        if (val) return val;
      }
    }
  }

  for (const [key, value] of personal) {
    if (norm.includes(key) || key.includes(norm)) return value;
  }
  return null;
}

function isProjectField(label: string): boolean {
  const norm = normalizeLabel(label);
  return /project|portfolio|built|github\s*repo|side\s*project|personal\s*project/i.test(norm);
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
  const aWords = new Set(na.split(/\s+/));
  const bWords = nb.split(/\s+/).filter((w) => aWords.has(w));
  return bWords.length / Math.max(aWords.size, 1);
}

function matchAnswer(label: string, answers: AnswerExemplar[]): string | null {
  let best: { score: number; answer: string } | null = null;
  for (const ex of answers) {
    const score = fuzzyScore(label, ex.question);
    if (score >= 0.4 && (!best || score > best.score)) {
      best = { score, answer: ex.answer };
    }
  }
  return best?.answer ?? null;
}

export interface FillReferences {
  personal: Map<string, string>;
  projects: ProjectEntry[];
  answers: AnswerExemplar[];
  resumePath: string;
}

export function loadFillReferences(): FillReferences {
  const personal = parsePersonalInformation(readFileSync(PERSONAL_INFORMATION_FILE, "utf8"));
  let projects: ProjectEntry[] = [];
  let answers: AnswerExemplar[] = [];
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
  if (!existsSync(RESUME_FILE)) {
    throw new Error(
      `Missing resume at ${RESUME_FILE}. Copy your PDF there as resume.pdf before filling.`
    );
  }
  return { personal, projects, answers, resumePath: RESUME_FILE };
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

  const personalVal = matchPersonalInfo(label, refs.personal);
  if (personalVal) {
    return {
      value: interpolate(personalVal, ctx),
      source: "personal-information.md",
      confidence: "high",
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
