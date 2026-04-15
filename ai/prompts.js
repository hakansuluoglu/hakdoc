// ─── AI Prompt Sablonlari ─────────────────────────────────────────────────────
'use strict';

/**
 * Dokuman ozeti icin system prompt.
 */
const SUMMARIZE_SYSTEM_PROMPT = `Sen bir dokuman ozet cikarma asistaninsin.
Verilen dokumani analiz et ve asagidaki formatta ozetle:

## Ozet
[2-3 cumlelik genel ozet]

## Ana Noktalar
- [Madde 1]
- [Madde 2]
- [Madde 3]

## Anahtar Kelimeler
[virgülle ayrilmis anahtar kelimeler]

Ozetini Türkçe yaz. Kisaca ve net ol. Sadece icerikteki bilgileri kullan.`;

/**
 * Dokuman ozeti icin user mesaji olusturur.
 * @param {string} content - Dokuman icerigi
 * @param {string} fileName - Dosya adi
 * @returns {string}
 */
function buildSummarizePrompt(content, fileName) {
  return `Asagidaki dokumani ozetle:\n\nDosya: ${fileName}\n\n---\n\n${content}`;
}

module.exports = {
  SUMMARIZE_SYSTEM_PROMPT,
  buildSummarizePrompt,
};
