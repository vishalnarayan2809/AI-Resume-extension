// Copy background.js, content.js, manifest.json, raw_template.html and pdf.worker from node_modules to dist root
const fs = require('fs');
const path = require('path');

const root = __dirname + '/..';
const dist = path.join(root, 'dist');

function copy(srcRel, destRel) {
  const src = path.join(root, srcRel);
  const dest = path.join(dist, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('Copied', srcRel, '->', destRel);
}

function copyIfExists(srcRel, destRel) {
  const src = path.join(root, srcRel);
  if (fs.existsSync(src)) copy(srcRel, destRel);
}

// ensure dist exists
fs.mkdirSync(dist, { recursive: true });

copy('public/manifest.json', 'manifest.json');
// Do NOT copy popup/options HTML here; Vite outputs processed HTML into dist already.
copy('public/raw_template.html', 'raw_template.html');

copy('src/background.js', 'background.js');
copy('src/content.js', 'content.js');

// Copy icons directory if present
try {
  const srcIcons = path.join(root, 'public', 'icons');
  const destIcons = path.join(dist, 'icons');
  if (fs.existsSync(srcIcons)) {
    fs.mkdirSync(destIcons, { recursive: true });
    for (const f of fs.readdirSync(srcIcons)) {
      const s = path.join(srcIcons, f);
      const d = path.join(destIcons, f);
      if (fs.statSync(s).isFile()) fs.copyFileSync(s, d);
    }
    console.log('Copied icons/ into dist');
  } else {
    console.warn('No icons/ directory found in public/. Using Chrome default icon.');
  }
} catch (e) {
  console.warn('Failed copying icons:', e?.message);
}

// Copy pdfjs worker (for Options file parsing). Try .mjs first, then .js
(() => {
  const candidates = [
    'pdfjs-dist/build/pdf.worker.min.mjs',
    'pdfjs-dist/build/pdf.worker.min.js',
  ];
  for (const mod of candidates) {
    try {
      const pdfWorkerPath = require.resolve(mod);
      const targetName = 'pdf.worker.min.js';
      fs.copyFileSync(pdfWorkerPath, path.join(dist, targetName));
      console.log('Copied pdf.js worker as', targetName, 'from', mod);
      return;
    } catch (e) {
      // try next
    }
  }
  console.warn('pdfjs worker not found: tried .mjs and .js variants');
})();

// Move Vite-built HTML from dist/public/* to dist/* so manifest default_popup/options_page work
try {
  const builtPopup = path.join(dist, 'public', 'popup.html');
  const destPopup = path.join(dist, 'popup.html');
  if (fs.existsSync(builtPopup)) {
    fs.copyFileSync(builtPopup, destPopup);
    console.log('Placed popup.html at dist root');
  }
  const builtOptions = path.join(dist, 'public', 'options.html');
  const destOptions = path.join(dist, 'options.html');
  if (fs.existsSync(builtOptions)) {
    fs.copyFileSync(builtOptions, destOptions);
    console.log('Placed options.html at dist root');
  }
} catch (e) {
  console.warn('Failed moving built HTML:', e?.message);
}
