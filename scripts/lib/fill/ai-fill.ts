/**
 * AI-fill for open-ended application questions.
 *
 * Sources (in order):
 * 1. data/fill/ai-answers.json — written by the agent (or an LLM prep step) per job
 * 2. ANTHROPIC_API_KEY / OPENAI_API_KEY — live generation when set
 * 3. null — caller should leave blank / hand off (never paste a raw answers.md exemplar alone)
 */
import { existsSync, readFileSync } from "node:fs";
import { AI_ANSWERS_FILE } from "../paths.js";
import type { AnswerExemplar, FillContext, FillReferences, ProjectEntry } from "./fill-references.js";
import { interpolate, normalizeLabel } from "./fill-references.js";

export interface AiAnswersFile {
  page_id?: string;
  company?: string;
  role?: string;
  /** Map of form label → answer text */
  answers: Record<string, string>;
  cover_letter?: string;
}

export function loadAiAnswersFile(pageId?: string): AiAnswersFile | null {
  if (!existsSync(AI_ANSWERS_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(AI_ANSWERS_FILE, "utf8")) as AiAnswersFile;
    if (pageId && raw.page_id && raw.page_id !== pageId) return null;
    return raw;
  } catch {
    return null;
  }
}

export function lookupAiAnswer(label: string, file: AiAnswersFile | null): string | null {
  if (!file?.answers) return null;
  const norm = normalizeLabel(label);
  if (file.answers[label]) return file.answers[label]!;
  for (const [k, v] of Object.entries(file.answers)) {
    if (normalizeLabel(k) === norm) return v;
    if (norm.includes(normalizeLabel(k)) || normalizeLabel(k).includes(norm)) return v;
  }
  return null;
}

function buildPrompt(
  label: string,
  ctx: FillContext & { jobDescription?: string },
  refs: FillReferences
): string {
  const exemplars = refs.answers
    .slice(0, 8)
    .map((a: AnswerExemplar) => `Q: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");
  const project = refs.projects[0] as ProjectEntry | undefined;
  const projectBlurb = project
    ? `${project.name}\n${project.summary}\n${project.highlights}`
    : "";
  return [
    `You are helping fill a job application for ${ctx.role} at ${ctx.company}.`,
    `Write a concise, specific answer (1–3 short paragraphs) to this form question.`,
    `Ground the answer in the applicant's exemplars and projects below, and tailor it to the job description.`,
    `Do not invent employers or degrees. Do not use placeholder brackets.`,
    ``,
    `FORM QUESTION: ${label}`,
    ``,
    `JOB DESCRIPTION (excerpt):`,
    (ctx.jobDescription ?? "").slice(0, 4000) || "(not provided)",
    ``,
    `ANSWER EXEMPLARS:`,
    exemplars || "(none)",
    ``,
    `PROJECT NOTES:`,
    projectBlurb || "(none)",
    ``,
    `Return only the answer text.`,
  ].join("\n");
}

async function callAnthropic(prompt: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.map((c) => c.text ?? "").join("\n").trim() || null;
}

async function callOpenAi(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * Resolve an AI-fill answer. Never returns a raw unmatched exemplar paste without JD context
 * unless it came from ai-answers.json or a live LLM call.
 */
export async function resolveAiFill(
  label: string,
  refs: FillReferences,
  ctx: FillContext & { jobDescription?: string },
  pageId?: string
): Promise<{ value: string; source: "ai-answers.json" | "llm" } | null> {
  const file = loadAiAnswersFile(pageId);
  const fromFile = lookupAiAnswer(label, file);
  if (fromFile) {
    return { value: interpolate(fromFile, ctx), source: "ai-answers.json" };
  }

  const prompt = buildPrompt(label, ctx, refs);
  const fromLlm = (await callAnthropic(prompt)) ?? (await callOpenAi(prompt));
  if (fromLlm) return { value: fromLlm, source: "llm" };

  return null;
}

export function getAiCoverLetter(pageId?: string): string | null {
  const file = loadAiAnswersFile(pageId);
  return file?.cover_letter?.trim() || null;
}
