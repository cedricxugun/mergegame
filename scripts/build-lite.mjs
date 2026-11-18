// Bundles each lite prototype into one self-contained HTML file: scripts,
// All artwork and sound are inlined so the HTML can travel without a server.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist'), lite = path.join(dist, 'lite'), out = path.join(root, 'offline');
await fs.mkdir(out, {recursive: true});

const sprites = {};
for (const name of await fs.readdir(path.join(dist, 'assets', 'lite')))
  if (name.endsWith('.webp')) sprites[name.slice(0, -5)] = 'data:image/webp;base64,' + (await fs.readFile(path.join(dist, 'assets', 'lite', name))).toString('base64');
for (const name of await fs.readdir(path.join(dist, 'assets')))
  if (/^m3-.*\.svg$/.test(name)) sprites['svg:' + name.slice(0, -4)] = 'data:image/svg+xml;base64,' + (await fs.readFile(path.join(dist, 'assets', name))).toString('base64');

const targets = {
  a: {title: '风暴之后 · 三消 + 轻合成体验版', css: ['lite/shared/lite.css', 'match3-premium.css', 'lite/a/a.css']},
  b: {title: '风暴之后 · 横屏家园', css: ['lite/shared/lite.css', 'lite/b/b.css','lite/b/landscape.css']}
};
for (const [id, t] of Object.entries(targets)) {
  const result = await build({entryPoints: [path.join(lite,id,id==='b'?'entry.mjs':'app.mjs')], bundle: true, format: 'esm', target: 'es2022', minify: true, write: false, legalComments: 'none', logLevel: 'warning'});
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = (await Promise.all(t.css.map(f => fs.readFile(path.join(dist, f), 'utf8')))).join('\n');
  let bayScript = '';
  let inlineSprites = sprites;
  if (id === 'b') {
    inlineSprites = {};
    const assets = {};
    const dir = path.join(dist, 'assets', 'bay');
    for (const file of await fs.readdir(dir)) {
      const mime = file.endsWith('.webp') ? 'image/webp' : file.endsWith('.wav') ? 'audio/wav' : null;
      if (mime) assets[file] = 'data:' + mime + ';base64,' + (await fs.readFile(path.join(dir, file))).toString('base64');
    }
    bayScript = 'window.BAY_ASSETS=' + JSON.stringify(assets) + ';';
  }
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="theme-color" content="${id==='b'?'#19545e':'#2c3d29'}"><title>${t.title}</title><style>${css}</style></head>
<body><main id="app" class="app" aria-label="${t.title}"></main><script>window.LITE_SPRITES=${JSON.stringify(inlineSprites)};${bayScript}</script><script type="module">${js}</script></body></html>`;
  const file = path.join(out, `forest-camp-lite-${id}.html`);
  await fs.writeFile(file, html);
  console.log(`${path.relative(root, file)}  ${(html.length / 1048576).toFixed(2)} MB`);
}
