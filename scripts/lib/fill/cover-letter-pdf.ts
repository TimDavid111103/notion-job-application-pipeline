/**
 * Generate a tailored cover-letter PDF under data/fill/cover-letters/.
 * Never upload the static template PDF — placeholders must be filled first.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { COVER_LETTERS_DIR, ensureParentDir } from "../paths.js";
import {
  buildCoverLetterText,
  type FillContext,
  type FillReferences,
} from "./fill-references.js";

const PLACEHOLDER_RE =
  /\[COMPANY\]|\[REFER TO MISSION STATEMENT AND\/OR CORE VALUE HERE\]|\[RELEVANT SKILL\s*[12]\]/i;

export function assertNoCoverLetterPlaceholders(text: string): void {
  const hit = text.match(PLACEHOLDER_RE);
  if (hit) {
    throw new Error(
      `Cover letter still contains placeholder ${hit[0]} — refusing to generate/upload PDF`
    );
  }
}

/** ASCII-safe for Times-Roman / filename. */
function pdfSafeText(text: string): string {
  return text
    .replace(/\u2014|\u2013/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function slugPart(raw: string): string {
  return (
    raw
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "Applicant"
  );
}

export function coverLetterFileName(refs: FillReferences, ctx: FillContext): string {
  const name = slugPart(refs.personal.get("full name") ?? "Applicant");
  const company = slugPart(ctx.company || "Company");
  return `${name}-${company}-cover-letter.pdf`;
}

function wrapLine(
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  text: string,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

export async function writeCoverLetterPdf(body: string, outPath: string): Promise<void> {
  assertNoCoverLetterPlaceholders(body);
  const safe = pdfSafeText(body);
  assertNoCoverLetterPlaceholders(safe);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontSize = 11;
  const lineHeight = 16;
  const margin = 72;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;

  const paragraphs = safe.split(/\n\s*\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const flat = para.replace(/\s*\n\s*/g, " ").trim();
    if (!flat) {
      lines.push("");
      continue;
    }
    lines.push(...wrapLine(font, flat, fontSize, maxWidth));
    lines.push("");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (line.length > 0) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
    y -= lineHeight;
  }

  const bytes = await pdfDoc.save();
  await ensureParentDir(outPath);
  await writeFile(outPath, bytes);
}

/**
 * Build tailored cover-letter text, write PDF under data/fill/cover-letters/, return path.
 * Uses cover-letter.md with JD placeholders filled.
 * Never returns the static assets/.../cover-letter-template.pdf path.
 */
export async function prepareCoverLetterPdf(
  refs: FillReferences,
  ctx: FillContext,
  bodyOverride?: string | null
): Promise<string> {
  const body = (bodyOverride?.trim() || buildCoverLetterText(refs, ctx)).trim();
  assertNoCoverLetterPlaceholders(body);

  const outPath = path.join(COVER_LETTERS_DIR, coverLetterFileName(refs, ctx));
  if (outPath.includes("cover-letter-template")) {
    throw new Error("Refusing to write cover letter path that looks like the static template");
  }
  await writeCoverLetterPdf(body, outPath);
  return outPath;
}
