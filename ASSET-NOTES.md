# 三消素材与规则参考

2026-10-16 第二轮增加合成端正式美术：`craft-wood-atlas.png`、`craft-water-atlas.png`、`craft-reed-atlas.png`、`craft-dock-atlas.png` 是 4×2 材料图集（前七格对应 L1–L7）；`craft-camp-scenes.png` 是 2×2 营地阶段图集；`craft-river-scenes.png` 与 `craft-ruins-atlas.png` 是 3×2 图集；另有 `craft-lina.png`、`craft-rowan.png`、`craft-world-bg.png` 与 `craft-supply-box.png`。全部在 `dist/assets`，沿用内置 image_gen。完整实际 prompts、调整记录和 alpha 检查保存在 [ASSET-PROMPTS-v11.json](ASSET-PROMPTS-v11.json)。

图集用比例 viewBox 和 SVG pattern 显示，未将原图编辑拼接成占位素材。材质统一为暖木、绳索、石材、蓝绿帆布和自然植被；未建造前使用独立遗址帧。生成器没有完全满足所有格子的留白目标，已逐格检查没有可见跨格，并在实际 iPhone 画面确认裁切、可读性和操作边界。透明像素中的隐藏 RGB 不影响正常 alpha 合成。

2026-10-16：本版素材由内置 image_gen 生成，为原创 PNG。没有使用 Royal Match 的角色、截图、商标或游戏资源。参考图只保存在忽略的 `.preview` 中，不随原型分发。

输出位于 `dist/assets`：`premium-leaf.png`、`premium-book.png`、`premium-crown.png`、`premium-shield.png`、`premium-gem.png`、`premium-rocket.png`、`premium-tnt.png`、`premium-propeller.png`、`premium-orb.png`、`premium-crate.png`、`premium-mira.png` 和 `match-garden-bg.png`。

所有透明物件为 1254×1254 RGBA，保留原始 alpha；背景 941×1672。逐张检查原图，并在实际手机比例棋盘中检查小尺寸轮廓。皇冠另经一次内置编辑增加留白。火箭和人物的垂直留白较少，在布局中单独调整显示尺寸。

生成的共同约束：一个居中的原创物件、透明背景、约 80–88% 主体占比、正面略俯视、厚倒角与可见侧面、饱和亮色、左上方宽软光、光泽树脂玩具质感、适合 44px 阅读，不含文字、徽标、UI、底座或额外物件。背景使用不透明竖幅。

各素材的主体 prompt：盾牌、紫晶和背景列出描述摘要，其余列出实际主体描述摘录。

| 文件 | 主体描述 |
| --- | --- |
| premium-leaf | one original emerald green thick leaf token, with a clear raised central ridge, broad plump leaf lobes, a short sturdy stem, and a simple unmistakable leaf silhouette |
| premium-book | one original ruby red compact CLOSED BOOK token. A simple, nearly square upright silhouette; a thick rounded padded red front cover, rounded red spine, a thin cream page block visibly inset between the covers, and only small polished gold corner protectors near the spine. The large front cover is entirely plain |
| premium-crown | one original rich golden-yellow rounded THREE-POINT CROWN token, viewed from the front. Exactly three broad crown points, the central point slightly taller, all tips very soft and rounded; a thick rounded solid lower band |
| premium-shield | one plump sapphire-blue shield, rounded triangular silhouette, thick beveled silver-blue rim, glossy solid blue center; simple readable volume |
| premium-gem | one plump amethyst-purple diamond, broad facets, rounded corners, glossy toy-like volume; clean and legible at small size |
| premium-rocket | one original UPRIGHT VERTICAL chubby red-and-white toy rocket. A rounded ruby-red nose at the top, a short wide cream-white cylindrical body with a broad red band, two stout golden-yellow tail fins, and a clearly visible dark silver metal exhaust nozzle at the bottom. No flame or smoke |
| premium-tnt | one original cartoon bundle of EXACTLY THREE short fat ruby-red cylindrical dynamite sticks, held together by a thick deep-navy-blue strap, with one short curled golden fuse. Two rounded cylinders in front and the third visible just behind them |
| premium-propeller | Exactly four chunky curved blades in saturated sapphire blue and bright cyan, clean rounded tips, clearly separated blade silhouettes, arranged symmetrically around a large polished golden circular hub |
| premium-orb | a large rounded jewel made from a small number of broad curved facets in vivid sapphire blue, ruby red, emerald green, amethyst purple and warm gold. Make the colorful sections large and readable, with a cohesive spherical volume; no tiny mosaic facets |
| premium-crate | The front face consists of exactly three broad horizontal wooden planks and one broad diagonal brace. Thick rounded beveled edges, simple oversized readable wood shapes, a few small simple metal rivets, subtle broad wood-grain accents only |
| premium-mira | an original female protagonist named Mira, approximately 30 years old, shown from the shoulders upward. Soft short auburn hair in a rounded gently waved bob, a green scarf, a simple cream shirt, warm friendly alert expression, a natural confident smile and bright attentive eyes |
| match-garden-bg | portrait forest garden, bright polished 3D casual-game rendering, distant cozy wooden cottage, central 70% a simple softly blurred clearing; no UI, text or characters |

玩法参考核对自官方帮助：[道具生成](https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/6-creating-and-using-the-power-ups/) 与 [道具组合](https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/7-power-up-combinations/)。本原型采用独立代码、关卡布局和原创图像。无商业成品品质等同承诺。
