// Generate extension icons from a source logo using sharp.
// Priority: public/logo.png|jpg|jpeg|svg -> src/assets/227665757.png -> public/vite.svg
// Outputs: public/icons/ai-presume-{16,32,48,128}.png
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const outDir = path.join(root, 'public', 'icons');
  fs.mkdirSync(outDir, { recursive: true });

  const candidates = [
    'public/logo.png',
    'public/logo.jpg',
    'public/logo.jpeg',
    'public/logo.svg',
    'public/ai-presume-logo.png',
    'src/assets/227665757.png',
    'public/vite.svg',
  ];

  let src = null;
  for (const rel of candidates) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) { src = abs; break; }
  }

  if (!src) {
    console.warn('[icons] No source logo found; skipping icon generation.');
    return;
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.warn('[icons] sharp is not installed. Skipping icon generation.');
    return;
  }

  const sizes = [16, 32, 48, 128];
  const baseName = 'ai-presume';

  const isSvg = src.toLowerCase().endsWith('.svg');
  const input = isSvg ? fs.readFileSync(src) : src;

  for (const size of sizes) {
    const dest = path.join(outDir, `${baseName}-${size}.png`);
    try {
      const pipeline = isSvg ? sharp(input, { density: 512 }) : sharp(input);
      await pipeline
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(dest);
      console.log('[icons] Wrote', path.relative(root, dest));
    } catch (e) {
      console.warn('[icons] Failed generating size', size, e?.message);
    }
  }
}

main().catch((e) => {
  console.error('[icons] Fatal:', e);
  process.exitCode = 1;
});
