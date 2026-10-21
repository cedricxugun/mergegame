import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const assets={};
for(const name of await fs.readdir(path.join(dist,'assets'))){const mime={'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[path.extname(name)];if(mime)assets[path.basename(name,path.extname(name))]=`data:${mime};base64,`+(await fs.readFile(path.join(dist,'assets',name))).toString('base64');}
const legacyAssets=Object.fromEntries(Object.entries(assets).filter(([name])=>!name.startsWith('premium-')&&!name.startsWith('craft-')&&name!=='match-garden-bg'));
const out=path.join(root,'offline');await fs.mkdir(out,{recursive:true});
const lessonGame=(await fs.readFile(path.join(dist,'first-stop.mjs'),'utf8')).replace(/^export /gm,'');
let lessonApp=(await fs.readFile(path.join(dist,'first-stop-app.mjs'),'utf8')).replace(/^import .*?;\r?\n/,'').replace(/^const asset=.*;$/m,'const asset=name=>ASSETS[name];');
const lessonScript=`(() => {\nconst ASSETS=${JSON.stringify(legacyAssets)};\n${lessonGame}\n${lessonApp}\n})();`;
new vm.Script(lessonScript);
let lessonHtml=await fs.readFile(path.join(dist,'first-stop.html'),'utf8');
lessonHtml=lessonHtml.replace('<link rel="stylesheet" href="./first-stop.css">',`<style>${await fs.readFile(path.join(dist,'first-stop.css'),'utf8')}</style>`).replace('<script type="module" src="./first-stop-app.mjs"></script>',`<script>${lessonScript}</script>`).replaceAll('./extended.html','./forest-camp-extended.html');
lessonHtml=lessonHtml.replace(/\.\/assets\/([a-z0-9-]+)\.svg/g,(_,name)=>{if(!assets[name])throw Error(`Missing asset ${name}`);return assets[name];});
if(lessonHtml.includes('./assets/')||lessonHtml.includes('src="./first-stop-app.mjs"'))throw Error('Incomplete first-stop offline bundle');
const lessonOutput=path.join(out,'forest-camp-first-stop.html');await fs.writeFile(lessonOutput,lessonHtml);
const classicModule=await import('../dist/homecoming.mjs'),playModule=await import('../dist/homecoming-play.mjs');
const classicExports=Object.keys(classicModule).join(','),playExports=Object.keys(playModule).join(',');
const classicCode=(await fs.readFile(path.join(dist,'homecoming.mjs'),'utf8')).replace(/^export /gm,'');
const playCode=(await fs.readFile(path.join(dist,'homecoming-play.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const homeGame=`const HomeClassic=(()=>{${classicCode}\nreturn {${classicExports}};})();\nconst {${playExports}}=(()=>{const Classic=HomeClassic;\n${playCode}\nreturn {${playExports}};})();`;
const homeView=(await fs.readFile(path.join(dist,'homecoming-view.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const homeProjection=(await fs.readFile(path.join(dist,'homecoming-projection.mjs'),'utf8')).replace(/^export /gm,'');
const homeWorld=(await fs.readFile(path.join(dist,'homecoming-world.mjs'),'utf8')).replace(/^export /gm,'');
const homeGesture=(await fs.readFile(path.join(dist,'homecoming-gesture.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const homeMomentum=(await fs.readFile(path.join(dist,'homecoming-momentum.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const artFrames=(await fs.readFile(path.join(dist,'homecoming-art-frames.mjs'),'utf8')).replace(/^export /gm,'');
const homeArt=(await fs.readFile(path.join(dist,'homecoming-art.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const homeStory=(await fs.readFile(path.join(dist,'homecoming-story.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const matchMotion=(await fs.readFile(path.join(dist,'match3-motion.mjs'),'utf8')).replace(/^export /gm,'');
const matchEffects=(await fs.readFile(path.join(dist,'match3-effects.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const matchLegacy=(await fs.readFile(path.join(dist,'match3.mjs'),'utf8')).replace(/^export /gm,'');
const matchPremium=(await fs.readFile(path.join(dist,'match3-premium.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const matchExports='M3_WIDTH,M3_HEIGHT,M3_COUNT,M3_COLORS,M3_POWERS,m3Adjacent,m3LevelConfig,m3FindMatches,m3Goals,m3Won,m3AvailableMoves,m3Hint,m3Create,m3Move,m3Valid';
const matchGame=`const M3Legacy=(()=>{${matchLegacy}\nreturn {m3Goals,m3AvailableMoves,m3Move,m3Valid};})();\nconst {${matchExports}}=(()=>{${matchPremium}\nreturn {${matchExports}};})();`;
const matchBridge=(await fs.readFile(path.join(dist,'journey-match.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const matchUI=(await fs.readFile(path.join(dist,'match3-premium-ui.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const homeApp=(await fs.readFile(path.join(dist,'homecoming-app.mjs'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^const asset=.*;$/m,"const asset=name=>ASSETS[name==='chest'?'craft-supply-box':name];");
const homeScript=`(() => {\nconst ASSETS=${JSON.stringify(assets)};\n${homeGame}\n${homeView}\n${homeProjection}\n${homeWorld}\n${homeGesture}\n${homeMomentum}\n${artFrames}\n${homeArt}\n${homeStory}\n${matchGame}\n${matchMotion}\n${matchEffects}\n${matchBridge}\n${matchUI}\n${homeApp}\n})();`;
new vm.Script(homeScript);
let homeHtml=await fs.readFile(path.join(dist,'index.html'),'utf8');
homeHtml=homeHtml.replace('<link rel="stylesheet" href="./homecoming.css">',`<style>${await fs.readFile(path.join(dist,'homecoming.css'),'utf8')}</style>`).replace('<link rel="stylesheet" href="./match3-premium.css">',`<style>${await fs.readFile(path.join(dist,'match3-premium.css'),'utf8')}</style>`).replace('<link rel="stylesheet" href="./homecoming-craft.css">',`<style>${await fs.readFile(path.join(dist,'homecoming-craft.css'),'utf8')}</style>`).replace('<link rel="stylesheet" href="./homecoming-garden.css">',`<style>${await fs.readFile(path.join(dist,'homecoming-garden.css'),'utf8')}</style>`).replace('<script type="module" src="./homecoming-app.mjs"></script>',`<script>${homeScript}</script>`).replaceAll('./first-stop.html','./forest-camp-first-stop.html');
homeHtml=homeHtml.replace(/\.\/assets\/([a-z0-9-]+)\.(?:svg|png|webp)/g,(_,name)=>{if(!assets[name])throw Error(`Missing asset ${name}`);return assets[name];});
if(homeHtml.includes('./assets/')||homeHtml.includes('src="./homecoming-app.mjs"'))throw Error('Incomplete homecoming offline bundle');
const output=path.join(out,'forest-camp.html');await fs.writeFile(output,homeHtml);
// Preserve the previous full camp as a separate offline comparison.
const game=(await fs.readFile(path.join(dist,'game.mjs'),'utf8')).replace(/^export /gm,'');
let app=(await fs.readFile(path.join(dist,'app.mjs'),'utf8')).replace(/^import .*?;\r?\n/,'');
app=app.replace(/^const art=.*;$/m,"const asset=name=>ASSETS[name]; const art=item=>asset(item.chain==='bridge'?'bridge':item.chain+'-'+item.level);");
const substitutions=[
  ['src="./assets/${key}-${chain.target}.svg"','src="${asset(key+\'-\'+chain.target)}"'],
  ['src="./assets/${state.departed?\'camp-6\':\'forest-2\'}.svg"','src="${asset(state.departed?\'camp-6\':\'forest-2\')}"'],
  ['href="./assets/region-${id}.svg"','href="${asset(\'region-\'+id)}"'],
  ['src="./assets/region-${id}.svg"','src="${asset(\'region-\'+id)}"'],
  ['href="./assets/${campArt}.svg"','href="${asset(campArt)}"']
];
for(const [from,to]of substitutions)app=app.replaceAll(from,to);
app=app.replace(/((?:src|href)=")\.\/assets\/([a-z0-9-]+)\.svg"/g,(_,prefix,name)=>prefix+'${asset(\''+name+'\')}"');
if(app.includes('./assets/'))throw Error('Unbundled asset reference remains');
const script=`(() => {\nconst ASSETS=${JSON.stringify(legacyAssets)};\n${game}\n${app}\n})();`;
new vm.Script(script);
const css=await fs.readFile(path.join(dist,'style.css'),'utf8');
let html=await fs.readFile(path.join(dist,'extended.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="./style.css">',`<style>${css}</style>`).replace('<script type="module" src="./app.mjs"></script>',`<script>${script}</script>`);
html=html.replace(/\.\/assets\/([a-z0-9-]+)\.svg/g,(_,name)=>{if(!assets[name])throw Error(`Missing asset ${name}`);return assets[name];});
const extendedOutput=path.join(out,'forest-camp-extended.html');await fs.writeFile(extendedOutput,html);
console.log(JSON.stringify({output,lessonOutput,extendedOutput,bytes:Buffer.byteLength(homeHtml),assets:Object.keys(assets).length,scriptParses:true,externalRequests:false}));
