// Bundles each lite prototype into one self-contained HTML file: scripts,
// styles and WebP sprites are inlined, so it opens from file:// or a chat
// attachment with no server. esbuild resolves from the parent workspace.
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
  b: {title: '风暴之后 · 纯合成体验版', css: ['lite/shared/lite.css', 'lite/b/b.css']}
};
for (const [id, t] of Object.entries(targets)) {
  const result = await build({entryPoints: [path.join(lite, id, 'app.mjs')], bundle: true, format: 'esm', target: 'es2022', minify: true, write: false, legalComments: 'none', logLevel: 'warning'});
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = (await Promise.all(t.css.map(f => fs.readFile(path.join(dist, f), 'utf8')))).join('\n');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="theme-color" content="#2c3d29"><title>${t.title}</title><style>${css}</style></head>
<body><main id="app" class="app" aria-label="${t.title}"></main><script>window.LITE_SPRITES=${JSON.stringify(sprites)};</script><script type="module">${js}</script></body></html>`;
  const file = path.join(out, `forest-camp-lite-${id}.html`);
  await fs.writeFile(file, html);
  console.log(`${path.relative(root, file)}  ${(html.length / 1048576).toFixed(2)} MB`);
}
