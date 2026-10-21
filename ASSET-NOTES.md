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


## v14：场景整体构图与可试装组件

新增的三张 PNG 为内置 image_gen 生成的原创图集：`dist/assets/craft-camp-scenes-v14.png`、`dist/assets/craft-river-scenes-v14.png`、`dist/assets/craft-forest-props-v14.png`。完整原始与修正提示词、来源路径、视觉检查和已知限制记录在 `ASSET-PROMPTS-v14.json`。原始素材保留。

布局参考 [Merge Gardens 官方演示](https://mergegardens.com/)：连片草地、弱化硬格线、树木与建筑形成较大体量、低级素材较小、前后遮挡按地面位置排序，以及更紧凑的 HUD。参考用于呈现设计，游戏内图片全部来自本项目资源。

旧图集的有效主体占比差异很大，河湾旧场景仅约 38.5–48%。v14 对 48 帧按 alpha>8 测量裁框，并保留护边和长宽比。`scripts/measure-art-frames.py` 只读取 PNG、生成 `dist/homecoming-art-frames.mjs`，不修改源像素。新版河湾图集有少量跨理论格线的独立轮廓，使用逐帧安全矩形防止裁掉溪流。

这些资源已通过本版渲染和手机尺寸可读性检查，不等同商业美术终审。人物、三消资源及部分旧材料继续沿用；下一步发行级验收仍包括全链风格审定、真机表现与资源性能。

## v15：连贯世界与参考包核对（2026-10-21）

本轮新增并实际引用的原创 PNG：

| 资源 | 用途 | 原始尺寸 |
| --- | --- | --- |
| `dist/assets/craft-homeland-v15b.png` | 营地、河湾共用的森林、草地、旧径及远岸整幅环境画 | 1536×1024 |
| `dist/assets/craft-creek-dry-v15.png` | 从泉眼到营地的干涸河床 | 2172×724 |
| `dist/assets/craft-creek-flow-v15.png` | 同一岸线恢复流水；试装只显示上游部分 | 2172×724 |

全部由内置 image_gen 生成或编辑；生成用的参考图仅为本项目已有原创资源。原像素与 alpha 保留，渲染使用 source rect；两种水渠共用 `[5,194,2166,339]` 的 x/y/width/height 裁框。完整提示词、生成路径、文件校验值和审阅记录在 `ASSET-PROMPTS-v15-background.json`。水渠两态有少量边缘像素漂移，因此没有宣称逐像素无缝。场景底画为有限构图，相机有边界；近景、全景和区域切换共用一个世界位置，不能将它当作任意平铺纹理。

### Merge Gardens 参考包的实际发现

输入为用户提供的 `Merge+Gardens_1.57.2_APKPure.xapk`，包内 manifest 声明版本 1.57.2、版本号 1632、包名 `com.futureplay.mergematch`。这是对该文件的静态分析，没有安装或运行它，也没有据此验证整个发行版本的运行行为。

- 容器内 `UnityDataAssetPack.apk` 包含 Addressables bundles；Unity 原始数据头提供 `6000.3.16f1` 版本信息。
- `_campbg.spriteatlasv2` 包含 1 张 4096×4096 Texture2D、136 个 Sprite 和 1 个 SpriteAtlas。解码查看后，可以直接辨认独立建筑、树群、地表块、河流、池塘、崖岸和雾片，并非完整花园的一张截图。
- `scenes_scenes_main` 含 2 个 Grid、3 个 Tilemap / TilemapRenderer；其中两个序列化 Tilemap 分别记录 632、638 个 tile entry。数量仅指序列化内容，不等同玩家实际开放格数。
- 资源名示例：`groundTexture_Grass02`、`GreenMainLight_var2`、`decoRiver_MainCamp_Summer`、`TreesModular`、`decoCliff01_MainCamp_Summer 1`、`decoMansion_MainCamp`、`MainGardenFog`。主场景也有对应独立装饰节点；图集内部分地表 Sprite 约 230×130 px。

由这些直接证据可判断：至少该包的主花园使用分层地面与独立景物组织，不能说完全由一张整图实现。“先统一设计整片世界，再拆层显示”是本项目据此采用的美术制作判断。我们的有限两站原型选择一张原创环境底画配合动态河床、建筑及素材层，便于保持构图一致；这不声称复刻其内部引擎。

参考解码和结构记录仅保存在 Git 忽略的 `.preview/merge-gardens-1.57.2/`，不随游戏资源或 Git 提交分发。此前官方演示参考仍为 https://mergegardens.com/ 。

## v16：草皮可读性与物件接地（2026-10-21）

继续静态核对用户提供的 1.57.2 包后，有两项直接证据：主场景 Tilemap 8451 的 638 个条目严格按坐标 `(x+y)%2` 交替使用 `NewGardenTile2`（321 格）与 `NewGardenTile1`（317 格）；地表图本身有明暗差别和草叶边缘。抽样 `wood2`、`wildFlower5`、`oakTree7`、`water1`、`mossyLog1` 五个 Sprite，接地点从图上方量约在高度的 65.6%–85.2%，并不在 alpha 最下沿；样本自带紧贴底部的阴影、土壤或草根。这五个 prefab 没有独立 Shadow 子节点，但包内其他物体有，不能将该结论推广到全部物件。原图与精确数据只保存在忽略目录 `.preview/v16-reference/`。

本轮原创建材图集 `dist/assets/craft-ground-contact-v16.png` 为 1536×1024 RGBA、3×2，包含浅草皮、深草皮，以及木屑、湿土、根土、砾土贴地样本。内置 image_gen 一次生成加一次布局修正；输入参考仅为本项目原创背景与材质图，没有使用参考包图片。完整 prompts、原始生成路径和校验值在 `ASSET-PROMPTS-v16-ground.json`。`measure-art-frames.py` 读取并记录六帧裁框，原 PNG 像素与 alpha 保留。

实际游戏用浅／深草皮结合第三档明暗映射六边格。六边格的相邻图不能用两色让所有邻格不同，`turfTone` 因此使用三档；每个面裁切在同一套实际命中边界内。工作区常驻可辨认的草皮节奏，选择、拖拽和三格轮廓进一步加强。

物件改用本项目逐帧目视校准的脚点与底部配置，未照搬参考游戏数值。平放木板、木条和草卷使用贴合角度的窄影；盆罐按底径收紧；框架、桶架和基础桩使用多个支脚接触影。正常放置时取消整轮廓 CSS drop-shadow。水滴、芦苇苗及根团只使用与本身底径匹配的小范围湿土／根土；其余材料和建筑不套统一土垫。图集保留木屑与砾土原始帧，当前版本不将它们铺在每件材料下。

四条链全部 28 级已在独立校准页逐件审阅，游戏里继续验证手机尺寸、连续拖拽、试装／取回和落点命中。校准页与研究图均保留在 `.preview` 中，不随游戏发布。这些数据描述本次原型的视觉校准，不构成对参考游戏全部运行时渲染的推断。
