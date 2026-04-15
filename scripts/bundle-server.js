#!/usr/bin/env node
/**
 * Prepares src-tauri/server-dist/ for bundling into the Tauri app.
 * Run automatically via beforeBuildCommand in tauri.conf.json.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'src-tauri', 'server-dist');

// Clean and recreate
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.mkdirSync(path.join(dest, 'ai'), { recursive: true });

// Copy server files
for (const file of ['server.js', 'package.json']) {
  fs.copyFileSync(path.join(root, file), path.join(dest, file));
}
for (const file of ['prompts.js', 'provider.js', 'routes.js']) {
  fs.copyFileSync(path.join(root, 'ai', file), path.join(dest, 'ai', file));
}

// Install production dependencies
console.log('Installing production dependencies into server-dist...');
execSync('npm install --omit=dev', { cwd: dest, stdio: 'inherit' });

console.log('server-dist ready.');
