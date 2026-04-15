// Load .env: prefer ~/.config/hakdoc/.env, fall back to project root .env
const path = require('path');
const fs = require('fs');
const os = require('os');
const _hakdocEnvPath = path.join(os.homedir(), '.config', 'hakdoc', '.env');
if (fs.existsSync(_hakdocEnvPath)) {
  require('dotenv').config({ path: _hakdocEnvPath });
} else {
  require('dotenv').config();
}

const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 14296;

let DOCS_ROOT = process.env.DOCS_ROOT || path.join(os.homedir(), 'Documents/hakdoc');
const upload = multer({ dest: path.join(os.tmpdir(), 'docwebapp_uploads') });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic /raw middleware — re-resolves DOCS_ROOT on every request
// so it stays correct after POST /api/config changes the folder.
app.use('/raw', (req, res, next) => {
  express.static(DOCS_ROOT)(req, res, next);
});

// ─── AI Route'lari ───────────────────────────────────────────────────────────
const aiRoutes = require('./ai/routes');
app.use('/api/ai', aiRoutes);

function isHidden(name) {
  return name.startsWith('.');
}

// ─── Config API ──────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    docsRoot: DOCS_ROOT,
    needsSetup: !fs.existsSync(DOCS_ROOT)
  });
});

app.post('/api/config', (req, res) => {
  const { docsRoot } = req.body;
  if (!docsRoot || typeof docsRoot !== 'string') {
    return res.status(400).json({ error: 'docsRoot is required' });
  }
  const expanded = docsRoot.replace(/^~/, os.homedir());
  try {
    if (!fs.existsSync(expanded)) {
      fs.mkdirSync(expanded, { recursive: true });
    }
    const configDir = path.join(os.homedir(), '.config', 'hakdoc');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const envPath = path.join(configDir, '.env');
    const envVars = _readEnvFile(envPath);
    envVars.DOCS_ROOT = expanded;
    _writeEnvFile(envPath, envVars);
    DOCS_ROOT = expanded;
    process.env.DOCS_ROOT = expanded;
    res.json({ success: true, docsRoot: DOCS_ROOT });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Settings API ────────────────────────────────────────────────────────────
const HAKDOC_ENV_PATH = path.join(os.homedir(), '.config', 'hakdoc', '.env');

// Provider definitions — which env vars each provider needs
const PROVIDER_DEFS = {
  openai:      { fields: ['OPENAI_API_KEY', 'OPENAI_MODEL'], defaults: { OPENAI_MODEL: 'gpt-4o-mini' } },
  anthropic:   { fields: ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'], defaults: { ANTHROPIC_MODEL: 'claude-sonnet-4-20250514' } },
  google:      { fields: ['GOOGLE_API_KEY', 'GOOGLE_MODEL'], defaults: { GOOGLE_MODEL: 'gemini-2.0-flash' } },
  ollama:      { fields: ['OLLAMA_BASE_URL', 'OLLAMA_MODEL'], defaults: { OLLAMA_BASE_URL: 'http://localhost:11434', OLLAMA_MODEL: 'llama3.2' } },
  lmstudio:    { fields: ['LMSTUDIO_BASE_URL', 'LMSTUDIO_MODEL'], defaults: { LMSTUDIO_BASE_URL: 'http://localhost:1234/v1', LMSTUDIO_MODEL: 'local-model' } },
  deepseek:    { fields: ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'], defaults: { DEEPSEEK_MODEL: 'deepseek-chat' } },
  openrouter:  { fields: ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL'], defaults: { OPENROUTER_MODEL: 'meta-llama/llama-3-70b-instruct' } },
  zhipu:       { fields: ['ZHIPU_API_KEY', 'ZHIPU_BASE_URL', 'ZHIPU_MODEL'], defaults: { ZHIPU_MODEL: 'GLM-4.7-FlashX' } },
};

/**
 * Read a .env file into an object. Handles comments and empty lines.
 */
function _readEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    vars[key] = val;
  }
  return vars;
}

/**
 * Write an object of key=value pairs to a .env file.
 */
function _writeEnvFile(filePath, vars) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lines = Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

app.get('/api/settings', (req, res) => {
  try {
    const envVars = _readEnvFile(HAKDOC_ENV_PATH);
    const activeProvider = (envVars.AI_PROVIDER || '').toLowerCase().trim();

    // Build per-provider saved config
    const providers = {};
    for (const [name, def] of Object.entries(PROVIDER_DEFS)) {
      const config = {};
      for (const field of def.fields) {
        config[field] = envVars[field] || def.defaults[field] || '';
      }
      providers[name] = config;
    }

    res.json({
      docsRoot: DOCS_ROOT,
      activeProvider: activeProvider || '',
      providers,
      providerDefs: PROVIDER_DEFS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  const { docsRoot, activeProvider, providerConfigs } = req.body;
  try {
    const envVars = _readEnvFile(HAKDOC_ENV_PATH);

    // Update DOCS_ROOT if provided
    if (docsRoot && typeof docsRoot === 'string') {
      const expanded = docsRoot.replace(/^~/, os.homedir());
      if (!fs.existsSync(expanded)) {
        fs.mkdirSync(expanded, { recursive: true });
      }
      DOCS_ROOT = expanded;
      process.env.DOCS_ROOT = expanded;
      envVars.DOCS_ROOT = expanded;
    }

    // Update AI provider
    if (typeof activeProvider === 'string') {
      envVars.AI_PROVIDER = activeProvider;
      process.env.AI_PROVIDER = activeProvider;
    }

    // Update provider-specific configs
    if (providerConfigs && typeof providerConfigs === 'object') {
      for (const [providerName, config] of Object.entries(providerConfigs)) {
        const def = PROVIDER_DEFS[providerName];
        if (!def) continue;
        for (const field of def.fields) {
          if (config[field] !== undefined) {
            envVars[field] = config[field];
            process.env[field] = config[field];
          }
        }
      }
    }

    _writeEnvFile(HAKDOC_ENV_PATH, envVars);

    res.json({ success: true, docsRoot: DOCS_ROOT });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildTree(dirPath, relativeTo) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (isHidden(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(relativeTo, fullPath);
    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        type: 'folder',
        path: relPath,
        children: buildTree(fullPath, relativeTo)
      });
    } else {
      result.push({
        name: entry.name,
        type: 'file',
        path: relPath
      });
    }
  }
  result.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name, 'tr');
  });
  return result;
}

app.get('/api/tree', (req, res) => {
  try {
    const tree = buildTree(DOCS_ROOT, DOCS_ROOT);
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/file', (req, res) => {
  try {
    const filePath = path.join(DOCS_ROOT, req.query.path);
    if (!filePath.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, name: path.basename(filePath) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/file', (req, res) => {
  try {
    const { filePath, content } = req.body;
    const fullPath = path.join(DOCS_ROOT, filePath);
    if (!fullPath.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folder', (req, res) => {
  try {
    const { folderPath } = req.body;
    const fullPath = path.join(DOCS_ROOT, folderPath);
    if (!fullPath.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (fs.existsSync(fullPath)) {
      return res.status(409).json({ error: 'Folder already exists' });
    }
    fs.mkdirSync(fullPath, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/file', (req, res) => {
  try {
    const filePath = path.join(DOCS_ROOT, req.query.path);
    if (!filePath.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rename', (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const fullOld = path.join(DOCS_ROOT, oldPath);
    const fullNew = path.join(path.dirname(fullOld), newName);
    if (!fullOld.startsWith(DOCS_ROOT) || !fullNew.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(fullOld)) {
      return res.status(404).json({ error: 'Not found' });
    }
    fs.renameSync(fullOld, fullNew);
    const newRelPath = path.relative(DOCS_ROOT, fullNew);
    res.json({ success: true, newPath: newRelPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/move', (req, res) => {
  try {
    const { sourcePath, targetFolder } = req.body;
    const fullSource = path.join(DOCS_ROOT, sourcePath);
    const fullTargetDir = path.join(DOCS_ROOT, targetFolder);
    if (!fullSource.startsWith(DOCS_ROOT) || !fullTargetDir.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(fullSource)) {
      return res.status(404).json({ error: 'Source not found' });
    }
    if (!fs.existsSync(fullTargetDir) || !fs.statSync(fullTargetDir).isDirectory()) {
      return res.status(400).json({ error: 'Target is not a folder' });
    }
    const fileName = path.basename(fullSource);
    const fullDest = path.join(fullTargetDir, fileName);
    if (fs.existsSync(fullDest)) {
      return res.status(409).json({ error: 'A file with this name already exists in the target folder' });
    }
    fs.renameSync(fullSource, fullDest);
    const newRelPath = path.relative(DOCS_ROOT, fullDest);
    res.json({ success: true, newPath: newRelPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    const targetFolder = req.body.targetFolder || '';
    const fullTargetDir = path.join(DOCS_ROOT, targetFolder);
    if (!fullTargetDir.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(fullTargetDir)) {
      fs.mkdirSync(fullTargetDir, { recursive: true });
    }
    
    for (const file of req.files) {
      const destPath = path.join(fullTargetDir, file.originalname);
      fs.copyFileSync(file.path, destPath);
      fs.unlinkSync(file.path);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }
    
    const results = [];
    const queryLower = query.toLowerCase();

    function searchDir(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (isHidden(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(DOCS_ROOT, fullPath);
        
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          const binaryExts = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.zip', '.tar', '.gz'];
          
          if (entry.name.toLowerCase().includes(queryLower)) {
            results.push({ path: relPath, name: entry.name, matchType: 'name' });
            continue;
          }
          
          if (!binaryExts.includes(ext)) {
            try {
               const content = fs.readFileSync(fullPath, 'utf8');
               if (content.toLowerCase().includes(queryLower)) {
                 results.push({ path: relPath, name: entry.name, matchType: 'content' });
               }
            } catch (e) {
               // ignore
            }
          }
        }
      }
    }
    
    searchDir(DOCS_ROOT);
    res.json({ results: results.slice(0, 50) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bulk-delete', (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'paths array required' });
    }
    const failed = [];
    for (const p of paths) {
      try {
        const fullPath = path.join(DOCS_ROOT, p);
        if (!fullPath.startsWith(DOCS_ROOT)) { failed.push(p); continue; }
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      } catch (e) {
        failed.push(p);
      }
    }
    res.json({ success: true, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bulk-move', (req, res) => {
  try {
    const { paths, targetFolder } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'paths array required' });
    }
    const fullTargetDir = path.join(DOCS_ROOT, targetFolder || '');
    if (!fullTargetDir.startsWith(DOCS_ROOT)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(fullTargetDir) || !fs.statSync(fullTargetDir).isDirectory()) {
      return res.status(400).json({ error: 'Target is not a folder' });
    }
    const results = [];
    const failed = [];
    for (const p of paths) {
      try {
        const fullSource = path.join(DOCS_ROOT, p);
        if (!fullSource.startsWith(DOCS_ROOT)) { failed.push(p); continue; }
        if (!fs.existsSync(fullSource)) { failed.push(p); continue; }
        const baseName = path.basename(fullSource);
        let fullDest = path.join(fullTargetDir, baseName);
        // handle name conflicts with suffix
        if (fs.existsSync(fullDest)) {
          const ext = path.extname(baseName);
          const nameWithout = path.basename(baseName, ext);
          let i = 2;
          while (fs.existsSync(fullDest)) {
            fullDest = path.join(fullTargetDir, `${nameWithout}_${i}${ext}`);
            i++;
          }
        }
        fs.renameSync(fullSource, fullDest);
        results.push({ old: p, new: path.relative(DOCS_ROOT, fullDest) });
      } catch (e) {
        failed.push(p);
      }
    }
    res.json({ success: true, results, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  DocWebApp running at http://localhost:${PORT}\n`);
  console.log(`  Serving docs from: ${DOCS_ROOT}\n`);
});
