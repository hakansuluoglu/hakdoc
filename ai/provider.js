// ─── AI Provider Factory ─────────────────────────────────────────────────────
// .env'den aktif provider'i okur, AI SDK model nesnesi dondurur.
// Provider yoksa veya yapilandirma eksikse null dondurur.

'use strict';

const { createZhipu } = require('zhipu-ai-provider');

/**
 * Aktif AI provider'i ve model bilgisini dondurur.
 * @returns {{ model: object, providerName: string, modelName: string } | null}
 */
function getAIProvider() {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase().trim();

  if (!provider) return null;

  try {
    switch (provider) {
      case 'zhipu': {
        const apiKey = process.env.ZHIPU_API_KEY;
        if (!apiKey) return null;

        const baseURL = process.env.ZHIPU_BASE_URL;
        const modelName = process.env.ZHIPU_MODEL || 'GLM-4.7-FlashX';

        const zhipu = createZhipu({
          apiKey,
          ...(baseURL ? { baseURL } : {}),
        });

        return {
          model: zhipu(modelName),
          providerName: 'zhipu',
          modelName,
        };
      }

      // Gelecekte eklenecek provider'lar buraya eklenir
      // case 'openai': { ... }
      // case 'google': { ... }
      // case 'anthropic': { ... }
      // case 'ollama': { ... }
      // case 'lmstudio': { ... }
      // case 'deepseek': { ... }
      // case 'openrouter': { ... }

      default:
        console.warn(`[AI] Bilinmeyen provider: "${provider}"`);
        return null;
    }
  } catch (err) {
    console.error('[AI] Provider olusturulurken hata:', err.message);
    return null;
  }
}

module.exports = { getAIProvider };
