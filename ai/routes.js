// ─── AI Express Route'lari ────────────────────────────────────────────────────
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { streamText } = require('ai');
const { getAIProvider } = require('./provider');
const { SUMMARIZE_SYSTEM_PROMPT, buildSummarizePrompt } = require('./prompts');

const router = express.Router();

// DOCS_ROOT'u server.js'den alabilmek icin env'den okuyoruz
const os = require('os');
const DOCS_ROOT = process.env.DOCS_ROOT || path.join(os.homedir(), 'Documents/xx_hakdoc');

// ─── GET /api/ai/status ───────────────────────────────────────────────────────
// Frontend'in AI ozelliklerini gosterip gostermeyecegini belirler.
router.get('/status', (req, res) => {
  const ai = getAIProvider();
  if (!ai) {
    return res.json({ enabled: false });
  }
  res.json({
    enabled: true,
    provider: ai.providerName,
    model: ai.modelName,
  });
});

// ─── POST /api/ai/summarize ───────────────────────────────────────────────────
// Dosyayi okur, AI ile ozetler, SSE uzerinden stream eder.
router.post('/summarize', async (req, res) => {
  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'filePath gerekli' });
  }

  // Path traversal korunma
  const fullPath = path.join(DOCS_ROOT, filePath);
  if (!fullPath.startsWith(DOCS_ROOT)) {
    return res.status(403).json({ error: 'Erisim reddedildi' });
  }

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Dosya bulunamadi' });
  }

  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch (err) {
    return res.status(500).json({ error: 'Dosya okunamadi: ' + err.message });
  }

  if (!content.trim()) {
    return res.status(400).json({ error: 'Dosya bos' });
  }

  const ai = getAIProvider();
  if (!ai) {
    return res.status(503).json({ error: 'AI provider yapilandirilmamis' });
  }

  // SSE basliklari
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const fileName = path.basename(fullPath);
    const userMessage = buildSummarizePrompt(content, fileName);

    const result = await streamText({
      model: ai.model,
      system: SUMMARIZE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    });

    for await (const chunk of result.textStream) {
      // Her chunk'i SSE formatinda gonder
      const data = JSON.stringify({ text: chunk });
      res.write(`data: ${data}\n\n`);
    }

    // Stream bitti
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[AI] Summarize hatasi:', err.message);
    try {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } catch (_) {
      // Client baglantisi kesilmis olabilir
    }
  }
});

module.exports = router;
