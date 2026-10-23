/**
 * Expo export (single) no enlaza manifest ni favicon circular; lo corregimos en dist/.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const indexPath = path.join(distDir, 'index.html');

const publicFiles = [
  'favicon.png',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
];

for (const file of publicFiles) {
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (!fs.existsSync(src)) {
    console.warn(`[patch-web-export] skip missing ${file}`);
    continue;
  }
  fs.copyFileSync(src, dest);
}

if (!fs.existsSync(indexPath)) {
  console.warn('[patch-web-export] no dist/index.html');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<link rel="icon"[^>]*\/?>/gi, '');

const headTags = [
  '<link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />',
  '<link rel="icon" href="/favicon.ico" sizes="any" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
].join('\n');

html = html.replace('</head>', `${headTags}\n</head>`);
fs.writeFileSync(indexPath, html);
console.log('[patch-web-export] PWA icons and manifest linked in dist/index.html');
