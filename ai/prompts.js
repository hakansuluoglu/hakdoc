// ─── AI Prompt Sablonlari ─────────────────────────────────────────────────────
'use strict';

/**
 * Desteklenen dil kodlari ve karsiliklari.
 */
const LANGUAGE_NAMES = {
  tr: 'Turkish',
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  ja: 'Japanese',
};

/**
 * Dokuman ozeti icin system prompt — dile gore dinamik.
 * @param {string} langCode - 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ja'
 * @returns {string}
 */
function buildSummarizeSystemPrompt(langCode) {
  const language = LANGUAGE_NAMES[langCode] || 'Turkish';
  return `You are a document summarization assistant.
Analyze the given document and summarize it in the following format:

## Summary
[2-3 sentence general summary]

## Key Points
- [Point 1]
- [Point 2]
- [Point 3]

## Keywords
[comma-separated keywords]

IMPORTANT: Write your entire response in ${language}. Be concise and clear. Only use information from the document content.`;
}

/**
 * Dokuman ozeti icin user mesaji olusturur.
 * @param {string} content - Dokuman icerigi
 * @param {string} fileName - Dosya adi
 * @returns {string}
 */
function buildSummarizePrompt(content, fileName) {
  return `Summarize the following document:\n\nFile: ${fileName}\n\n---\n\n${content}`;
}

module.exports = {
  buildSummarizeSystemPrompt,
  buildSummarizePrompt,
};
