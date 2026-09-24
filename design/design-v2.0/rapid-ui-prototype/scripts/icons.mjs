// Downloads a Material Symbols Outlined subset holding exactly the icons in
// src/ui/icons.ts (FILL 0..1, weight 400, grade 0, optical size 24), and writes
// it to public/fonts/ with the list it was built from. Run after editing the
// registry: `npm run icons`. The app never loads fonts from the network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const registry = fs.readFileSync(path.join(root, 'src/ui/icons.ts'), 'utf8');
const names = [...registry.matchAll(/^\s+'([a-z0-9_]+)',$/gm)].map((m) => m[1]).sort();
if (names.length === 0) throw new Error('No icon names found in src/ui/icons.ts');

const css = await fetch(
  `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${names.join(',')}&display=block`,
  // A current browser user agent gets woff2.
  { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36' } },
).then((r) => {
  if (!r.ok) throw new Error(`Google Fonts CSS: ${r.status}`);
  return r.text();
});
const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
if (!url) throw new Error(`No font URL in:\n${css}`);
const font = Buffer.from(await (await fetch(url)).arrayBuffer());

const out = path.join(root, 'public/fonts');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'material-symbols.woff2'), font);
fs.writeFileSync(path.join(out, 'material-symbols.json'), `${JSON.stringify({ icons: names }, null, 2)}\n`);
console.log(`material-symbols.woff2: ${names.length} icons, ${(font.length / 1024).toFixed(1)} KB`);
