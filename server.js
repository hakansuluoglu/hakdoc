const express = require('express');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();
const PORT = 14296;

const DOCS_ROOT = '/Users/hakan.suluoglu/Documents/xx_hakdoc';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function isHidden(name) {
  return name.startsWith('.') || name === 'DocWebApp';
}

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

app.listen(PORT, () => {
  console.log(`\n  DocWebApp running at http://localhost:${PORT}\n`);
  console.log(`  Serving docs from: ${DOCS_ROOT}\n`);
});
