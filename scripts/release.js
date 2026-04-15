#!/usr/bin/env node
/**
 * Release script — bumps version in package.json and tauri.conf.json,
 * commits, tags, and pushes.
 *
 * Usage: npm run release -- 1.2.3
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run release -- <version>  (e.g. 1.2.3)');
  process.exit(1);
}

const root = path.join(__dirname, '..');

// Update package.json
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ package.json → ${version}`);

// Update tauri.conf.json
const tauriPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf-8'));
tauri.version = version;
fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');
console.log(`✓ tauri.conf.json → ${version}`);

// Git commit + tag + push
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
run('git add package.json src-tauri/tauri.conf.json');
run(`git commit -m "chore: release v${version}"`);
run(`git tag v${version}`);
run('git push');
run(`git push origin v${version}`);

console.log(`\n✓ Released v${version} — GitHub Actions will build and publish the DMG.`);
