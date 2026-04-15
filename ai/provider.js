// ─── AI Provider Factory ─────────────────────────────────────────────────────
// .env'den aktif provider'i okur, AI SDK model nesnesi dondurur.
// Provider yoksa veya yapilandirma eksikse null dondurur.

'use strict';

const { createZhipu } = require('zhipu-ai-provider');
const { createOpenAI } = require('@ai-sdk/openai');

// Optional providers — may not be installed
let createAnthropic, createGoogleGenerativeAI;
try { createAnthropic = require('@ai-sdk/anthropic').createAnthropic; } catch (_) {}
try { createGoogleGenerativeAI = require('@ai-sdk/google').createGoogleGenerativeAI; } catch (_) {}

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

      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return null;

        const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const openai = createOpenAI({ apiKey });

        return {
          model: openai(modelName),
          providerName: 'openai',
          modelName,
        };
      }

      case 'anthropic': {
        if (!createAnthropic) {
          console.warn('[AI] @ai-sdk/anthropic is not installed. Run: npm install @ai-sdk/anthropic');
          return null;
        }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return null;

        const modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
        const anthropic = createAnthropic({ apiKey });

        return {
          model: anthropic(modelName),
          providerName: 'anthropic',
          modelName,
        };
      }

      case 'google': {
        if (!createGoogleGenerativeAI) {
          console.warn('[AI] @ai-sdk/google is not installed. Run: npm install @ai-sdk/google');
          return null;
        }
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return null;

        const modelName = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';
        const google = createGoogleGenerativeAI({ apiKey });

        return {
          model: google(modelName),
          providerName: 'google',
          modelName,
        };
      }

      case 'ollama': {
        const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const modelName = process.env.OLLAMA_MODEL || 'llama3.2';

        // Ollama uses OpenAI-compatible API
        const ollama = createOpenAI({
          baseURL: baseURL + '/v1',
          apiKey: 'ollama',
        });

        return {
          model: ollama(modelName),
          providerName: 'ollama',
          modelName,
        };
      }

      case 'lmstudio': {
        const baseURL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
        const modelName = process.env.LMSTUDIO_MODEL || 'local-model';

        const lmstudio = createOpenAI({
          baseURL,
          apiKey: 'lm-studio',
        });

        return {
          model: lmstudio(modelName),
          providerName: 'lmstudio',
          modelName,
        };
      }

      case 'deepseek': {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) return null;

        const modelName = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        const deepseek = createOpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey,
        });

        return {
          model: deepseek(modelName),
          providerName: 'deepseek',
          modelName,
        };
      }

      case 'openrouter': {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) return null;

        const modelName = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-70b-instruct';
        const openrouter = createOpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey,
        });

        return {
          model: openrouter(modelName),
          providerName: 'openrouter',
          modelName,
        };
      }

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
