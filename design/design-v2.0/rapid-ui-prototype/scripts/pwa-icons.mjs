// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Run after changing the SVG: `node scripts/pwa-icons.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const dir = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public/icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (file, size, padding = 0) => {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - padding * 2;
  await page.setContent(`<body style="margin:0;background:#9f3c16"><div style="padding:${padding}px;width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
  await page.screenshot({ path: path.join(dir, file), omitBackground: padding === 0 });
};
await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('apple-touch-icon.png', 180);
// Maskable: the safe zone is the central 80%, so the mark is padded.
await render('icon-maskable-512.png', 512, 52);
await browser.close();
console.log('icons written');
