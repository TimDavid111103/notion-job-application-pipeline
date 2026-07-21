/**
 * Open-ended fill from assets/answers.md (sole source of truth).
 *
 * Optional ANTHROPIC_API_KEY / OPENAI_API_KEY: rewrite the ranked seed for the JD.
 * No answers.md retrieval hit → leave blank (do not invent).
 * Additional Information → "Please tell us about your relevant experience."
 */
import type { AnswerExemplar, FillContext, FillReferences, ProjectEntry } from "./fill-references.js";
import {
  canonicalOpenEndedQuestion,
  hasAnswersBasis,
  interpolate,
  rankAnswerExemplars,
} from "./fill-references.js";

export interface SeedMatch {
  theme: string;
  question: string;
  answer: string;
}

/** Top answers.md seed for a form label (after aliases), or null if no basis. */
export function seedAnswerForLabel(label: string, answers: AnswerExemplar[]): SeedMatch | null {
  const question = canonicalOpenEndedQuestion(label);
  const ranked = rankAnswerExemplars(question, answers, 1, 0.35);
  const top = ranked[0];
  if (!top) return null;
  return { theme: top.theme, question: top.question, answer: top.answer };
}

function buildPrompt(
  label: string,
  ctx: FillContext & { jobDescription?: string },
  refs: FillReferences,
  seed: SeedMatch
): string {
  const question = canonicalOpenEndedQuestion(label);
  const ranked = rankAnswerExemplars(question, refs.answers, 4, 0.35);
  const exemplars = ranked
    .map((a) => `[${a.theme}]\nQ: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");
  const project = refs.projects[0] as ProjectEntry | undefined;
  const projectBlurb = project
    ? `${project.name}\n${project.summary}\n${project.highlights}`
    : "";
  return [
    `You are helping fill a job application for ${ctx.role} at ${ctx.company}.`,
    `Write a concise, specific answer (1–3 short paragraphs) to this form question.`,
    `Ground the answer in the answers.md seeds below (source of truth) and tailor to the job description.`,
    `Do not invent employers or degrees. Do not use placeholder brackets.`,
    ``,
    `FORM QUESTION: ${question}`,
    ``,
    `PRIMARY SEED (from answers.md):`,
    `Theme: ${seed.theme}`,
    `Q: ${seed.question}`,
    `A: ${seed.answer}`,
    ``,
    `JOB DESCRIPTION (excerpt):`,
    (ctx.jobDescription ?? "").slice(0, 4000) || "(not provided)",
    ``,
    `OTHER CLOSE SEEDS:`,
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
 * Resolve an open-ended answer from answers.md (optional live LLM tailor).
 */
export async function resolveAiFill(
  label: string,
  refs: FillReferences,
  ctx: FillContext & { jobDescription?: string },
  _pageId?: string
): Promise<{ value: string; source: "llm" | "answers.md" } | null> {
  if (!hasAnswersBasis(label, refs.answers)) {
    return null;
  }

  const seed = seedAnswerForLabel(label, refs.answers);
  if (!seed) return null;

  const prompt = buildPrompt(label, ctx, refs, seed);
  const fromLlm = (await callAnthropic(prompt)) ?? (await callOpenAi(prompt));
  if (fromLlm) return { value: fromLlm, source: "llm" };

  return { value: interpolate(seed.answer, ctx), source: "answers.md" };
}
