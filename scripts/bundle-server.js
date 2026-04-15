#!/usr/bin/env node
/**
 * Prepares src-tauri/server-dist/ for bundling into the Tauri app.
 * Uses esbuild to bundle server.js + all CJS dependencies into a single file,
 * eliminating node_modules and avoiding Tauri resource-glob path issues.
 *
 * Run automatically via beforeBuildCommand in tauri.conf.json.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'src-tauri', 'server-dist');

// ─── Clean and recreate output dir ───────────────────────────────────────────
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

// ─── Bundle server.js with esbuild ───────────────────────────────────────────
// Mark optional providers as external so they stay as require() calls that
// fail silently at runtime (caught by try/catch in ai/provider.js).
// esbuild produces a single output file — no chunks, no node_modules needed.
console.log('Bundling server.js with esbuild...');
execSync(
  [
    'npx --yes esbuild server.js',
    '--bundle',
    '--platform=node',
    `--outfile="${path.join(dest, 'server.js')}"`,
    '--external:@ai-sdk/anthropic',
    '--external:@ai-sdk/google',
  ].join(' '),
  { cwd: root, stdio: 'inherit' }
);

// ─── Copy public/ directory ───────────────────────────────────────────────────
// The Tauri window loads http://localhost:14296, so Express must serve these
// files. In the packaged app __dirname === Contents/Resources/, so we need
// public/ to live there alongside server.js.
console.log('Copying public/ directory...');
copyDir(path.join(root, 'public'), path.join(dest, 'public'));

console.log('server-dist ready.');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function copyDir(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}
