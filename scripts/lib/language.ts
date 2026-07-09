/**
 * Lightweight English detection for scraped job descriptions.
 * Used to filter non-English postings that should be removed from the tracker.
 */

/** Scripts that indicate non-English content when present in meaningful quantity. */
const NON_LATIN_SCRIPT =
  /[\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

/** Common English words in job postings — enough hits signal English prose. */
const ENGLISH_HINTS = new Set([
  "about",
  "ability",
  "across",
  "and",
  "apply",
  "are",
  "as",
  "at",
  "be",
  "benefits",
  "business",
  "can",
  "collaborate",
  "company",
  "customer",
  "data",
  "degree",
  "develop",
  "development",
  "engineering",
  "environment",
  "experience",
  "for",
  "have",
  "in",
  "including",
  "is",
  "join",
  "knowledge",
  "looking",
  "must",
  "of",
  "on",
  "opportunity",
  "or",
  "our",
  "position",
  "preferred",
  "qualifications",
  "requirements",
  "responsibilities",
  "role",
  "skills",
  "strong",
  "team",
  "that",
  "the",
  "this",
  "to",
  "we",
  "will",
  "with",
  "work",
  "working",
  "you",
  "your",
]);

/** French (and similar Romance) function words that signal non-English Latin text. */
const NON_ENGLISH_LATIN_HINTS = new Set([
  "au",
  "aux",
  "avec",
  "chez",
  "comme",
  "cette",
  "dans",
  "des",
  "du",
  "en",
  "et",
  "integrateur",
  "les",
  "metiers",
  "notre",
  "nous",
  "pour",
  "projets",
  "reinventer",
  "sur",
  "technicien",
  "une",
  "vous",
]);

const MIN_SAMPLE_CHARS = 80;
const MIN_ENGLISH_RATIO = 0.06;
const MIN_NON_ENGLISH_LATIN_RATIO = 0.04;

/**
 * Returns true when the text appears to be English job-posting prose.
 * Short or empty samples are treated as English (let empty_content handle those).
 */
export function isEnglishDescription(text: string): boolean {
  const sample = text.replace(/\s+/g, " ").trim().slice(0, 4000);
  if (sample.length < MIN_SAMPLE_CHARS) return true;

  if (NON_LATIN_SCRIPT.test(sample)) return false;

  const words = sample.toLowerCase().match(/\b[a-zàâäéèêëïîôùûüçœæ]{3,}\b/gu) ?? [];
  if (words.length === 0) return true;

  let englishHits = 0;
  let nonEnglishLatinHits = 0;
  for (const word of words) {
    const normalized = word.normalize("NFD").replace(/\p{M}/gu, "");
    if (ENGLISH_HINTS.has(normalized)) englishHits++;
    if (NON_ENGLISH_LATIN_HINTS.has(normalized)) nonEnglishLatinHits++;
  }

  if (nonEnglishLatinHits / words.length >= MIN_NON_ENGLISH_LATIN_RATIO) return false;
  return englishHits / words.length >= MIN_ENGLISH_RATIO;
}
