// PWA用アイコン(バーベル柄)をPNGで生成する
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const BG = [17, 24, 39, 255]; // gray-900
const ACCENT = [249, 115, 22, 255]; // orange-500
const WHITE = [245, 245, 244, 255];

function makeIcon(size, pad = 0) {
  const png = new PNG({ width: size, height: size });
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    png.data[i] = c[0];
    png.data[i + 1] = c[1];
    png.data[i + 2] = c[2];
    png.data[i + 3] = c[3];
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);

  const s = size * (1 - pad * 2);
  const o = size * pad;
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = Math.round(o + y0 * s); y < Math.round(o + y1 * s); y++) {
      for (let x = Math.round(o + x0 * s); x < Math.round(o + x1 * s); x++) {
        set(x, y, c);
      }
    }
  };

  // バー
  rect(0.08, 0.465, 0.92, 0.535, WHITE);
  // 外側プレート
  rect(0.16, 0.24, 0.26, 0.76, ACCENT);
  rect(0.74, 0.24, 0.84, 0.76, ACCENT);
  // 内側プレート
  rect(0.29, 0.32, 0.36, 0.68, ACCENT);
  rect(0.64, 0.32, 0.71, 0.68, ACCENT);

  return PNG.sync.write(png);
}

const outDir = path.join(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), makeIcon(192));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), makeIcon(512));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), makeIcon(512, 0.12));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makeIcon(180));
console.log('icons generated in public/');
