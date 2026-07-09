/**
 * Unit checks for English language detection (no network).
 */
import assert from "node:assert/strict";
import { isEnglishDescription } from "../lib/language.js";

const ENGLISH_SAMPLE =
  "Develop machine learning models and algorithms to address business needs. " +
  "Collaborate with data scientists and software engineers to design and implement scalable solutions. " +
  "Requirements include experience with Python, strong communication skills, and a bachelor's degree.";

const FRENCH_SAMPLE =
  "Réinventer avec Accenture. En tant que Integrateur Senior Primavera à Paris, vous intervenez sur des " +
  "projets de transformation alliant expertises métiers, technologies et usage avancé de l'intelligence " +
  "artificielle. Piloter la transformation Project Controls pour des mégaprojets industriels.";

function testEnglishSample(): void {
  assert.equal(isEnglishDescription(ENGLISH_SAMPLE), true);
}

function testFrenchSample(): void {
  assert.equal(isEnglishDescription(FRENCH_SAMPLE), false);
}

function testShortTextPasses(): void {
  assert.equal(isEnglishDescription("Short"), true);
}

function testCyrillicRejected(): void {
  assert.equal(
    isEnglishDescription(
      "Мы ищем инженера с опытом разработки программного обеспечения и знанием современных технологий."
    ),
    false
  );
}

testEnglishSample();
testFrenchSample();
testShortTextPasses();
testCyrillicRejected();
console.log("language tests: ok");
