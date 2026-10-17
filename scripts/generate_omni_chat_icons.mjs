// Regenerate Omni Chat install icons from the same AI-assistant SVG used on sign-in.
// Run: node scripts/generate_omni_chat_icons.mjs
import { readFile, mkdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'client/public/assets');
const source = await readFile(join(assets, 'omni-chat-mark.svg'));
const outputs = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon-180x180.png', 180],
  ['icon-192x192.png', 192],
  ['maskable-icon.png', 512],
];
await mkdir(assets, { recursive: true });
for (const [name, size] of outputs) {
  const png = await sharp(source, { density: 512 })
    .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(assets, name), png);
  console.log(`Generated ${name}: ${size}x${size}`);
}
