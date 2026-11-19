# 潮湾合成物原画

2026-11-18 更新 28 件棋盘材料，木工、引水、护岸、栈桥各含七级。制作时以《Gossip Harbor》开发商发布的普通棋盘格为风格参考，观察浅蓝地面上的物件占比、轮廓、高光和接触阴影。为本游戏重新设计了四条材料链的造型。

## 最终图集的参考与导出

四次内置 ImageGen 调用均使用 `transparent_background: true`，并使用同一对 `referenced_image_paths`。第一张为 810 × 1440 的官方截图 `.preview/gossip-style/board.png`，SHA-256 `6d70bd9feb414ac5ee1a508adc111e3c1e33db767ea8d78c30444e88a1e723b9`。第二张为普通格子放大图 `.preview/gossip-style/material-reference-ordinary-cells.png`，从原图坐标 `[25,244,759,113]` 和 `[25,685,759,103]` 两行裁出。参考图用于美术比对，运行时文件为原创透明 WebP。

四张最终图集均为 1536 × 1024。通过 alpha 辨认真实轮廓，四周保留约 4 个源像素的抗锯齿余量，以原始比例导出最长边不超过 320 像素的 WebP。导出使用 quality 92 与 alphaQuality 100，28 张合计 707,180 字节。每件的实际尺寸与接地投影中心记录在 `dist/lite/b/material-metrics.mjs`。

交付前在 64 像素浅蓝棋格中逐件比较 48 像素显示效果，并在地面脚点示意图中检查支架脚、容器底、根束和木件支承面。

## 最终 ImageGen 提示词

各次调用的正文由下方共用段落以及该条材料链的专用段落拼接。

```text
USE CASE: stylized-concept. BRAND NEW GAME ASSETS. Image 1 is an official mobile merge-board screenshot as STYLE REFERENCE ONLY; Image 2 magnifies some regular tiles from that screenshot as a second STYLE REFERENCE. Study the ordinary little coffee cup, bread and teal machine on the normal pale-blue tiles, not the giant promotional lobster. Match that specific level of clean, bulging 2.5D cartoon volume, hand-painted airbrushed color blending, saturations, simple dark colored silhouette edge and upper-left white shine. DO NOT include or redraw any icon, name, food, person, board, UI, words, frames or tile from the reference; the new objects below are original woodcraft, waterworks or coast materials. They are illustrations for standard cells on a light blue game board.
Make a professional sprite sheet of exactly 7 different individual game icons with genuinely transparent alpha. Landscape 1536×1024. STRICT invisible atlas grid of 4 columns × 2 rows. Four in the top row, three in the LEFTMOST three cells of the bottom row; bottom right empty. Cell centers x12.5%,37.5%,62.5%,87.5%; y25%,75%. A full transparent gutter separates every sprite. Crop NOTHING. Within its cell each chubby self-contained silhouette occupies around 78% width/height, not a wispy skinny drawing. Consistent overhead 3/4 perspective as in the reference, compact almost square silhouettes wherever workable. Every icon instantly legible at 48 pixels with two or three large shapes and few accent shapes; strong optical mass, nicely exaggerated proportions, attractive color blocking. Actual implementation will scale each icon to 48 pixels on pale blue, so aim for a BIG bold ordinary cell item. Use narrow, soft, deeper-colored contour around the object's main planes; charming smoothly beveled volumes with broad peach or mint airbrush shine and a small white specular glint. Tactile candy colors with bright light-facing planes and comparatively rich but not black shaded areas. Look like polished mobile game inventory icons, NOT actual materials photographed or detailed wooden miniatures. No brushmark textures, woodgrain lines, realistic scratches, small hardware, mottling, mesh linework or tiny speckles. Prefer smooth forms, warm hue shifts, broad highlights. No thick white sticker outline, no base tile or podium, no backdrop of any kind, NO painted blue tile or UI, no letters nor numbers. All empty gaps and perimeters must be pure transparent alpha with no glow or photo haze. If used, a tiny faint desaturated navy contact shadow may hug the heaviest lower edge only. Each item in the exact order below, print no labels.
```

### 木工

```text
WOODWORK FAMILY. Color story rich mandarin-orange, golden apricot and coral red. The wood is smooth saturated and simplified exactly as the rounded objects in the style reference, no detailed grain; at most one simple graphic ring on a visible cut end. TOP ROW 1. ONE chubby short golden split billet, big rounded-square pale cut end to viewer, a single carved notch on its orange top. 2. Three stubby honey round logs in a tight pyramid, hugged by ONE broad cherry-red canvas strap, no thin ropes. 3. A fat portable roof patch of just two overlapping round-ended coral-orange shingles on a warm caramel crosspiece, with one chunky brass button. 4. A squat orange reinforcement bracket in a sturdy inverted-U carpenter joinery shape with two large feet, thick rounded beam across, a single coral side plate; visually a low gate, not a tall triangle. BOTTOM ROW 5. A freestanding triangular timber support: use two broad orange splayed beams and one big coral joint at apex like plump inverted V, one generous triangular opening. 6. A simple gable truss module with paired golden arches and one sloped coral roof spar, compact clearly three-dimensional roof frame about to be installed, no delicate lattice. 7. A rounded caramel construction kit with a bright coral rolled roof felt and two golden beams fitted inside; a bold solid almost cube-like unit. Cell eight fully transparent.
```

原图 `exec-2ec05272-e6d6-4f52-9a8a-8fdc27a3525e.png`，SHA-256 `15e6f934d11dc5aecac0c7587c8e712c82fe369fe2474511464e4b4166484616`。以下裁框按 L1 至 L7 顺序给出原图像素 x、y、宽、高。

```json
[[42,136,318,295],[401,116,345,318],[781,130,345,284],[1148,122,375,316],[18,604,355,320],[387,616,377,308],[784,602,348,331]]
```

### 引水

```text
WATER COLLECTION FAMILY. Candy aqua, cobalt blue, crisp turquoise and sunny gold. Use smooth ceramic, rounded chunky metal simplified into color shapes and clear white glints just like the glossy ordinary board items. TOP ROW 1. One BIG plump jewel-shaped turquoise water droplet with a broad rounded bottom settling onto the surface, light blue reflective sweep and exactly one white gleam, no face, no extra droplets. 2. A chunky shallow round turquoise collection basin with cream rim and blue water, wide belly and a tiny spout notch; no cup handles or coffee. 3. A fat cobalt filter jar with simple ivory domed lid, prominent lemon-yellow short side tap and a single water-drop emblem on the front. 4. A curved elbow water connector, oversized turquoise 90-degree spout with chunky gold coupling at either end and a glossy blue collector opening, a freestanding one-piece module. BOTTOM ROW 5. A plump upright aqua cistern with buttercream cap and one oversized buttery gold faucet, smooth smooth surfaces, short stout feet. 6. A low double-walled teal sluice channel fitted with one big CORAL gate wheel at back and visible bright aqua water in front, use only four large shapes. 7. A spherical cobalt spring distributor with a golden top lever and two short fat aqua outlet branches, compact strong silhouette, the most precious waterwork module, not a miniature building. Bottom-right blank.
```

原图 `exec-2b74a13c-ef8a-4061-82ea-873300b0db9e.png`，SHA-256 `6526b814f61e8cd71f5868e7d629d6f149bf96e56d5d115ac8ed0cc672805138`。以下裁框按 L1 至 L7 顺序给出原图像素 x、y、宽、高。

```json
[[60,100,298,345],[405,126,348,310],[793,84,326,361],[1170,109,345,327],[40,557,315,371],[392,561,363,369],[764,568,361,353]]
```

### 护岸

```text
REED & SHORE FAMILY. Bright apple green, deep teal leaf undersides, creamy yellow fresh shoots, orchid violet accents; keep leaf blades PLUMP and FEW. No realistic veins, hairy rootlets, landscaping bases, no bunches of fine grass. TOP ROW 1. A single chubby just-sprouted apple-green reed bud with a tiny yellow-green folded side leaf tucked against the body, a plain brown seed collar at its foot. Roll the main blade into a thick teardrop silhouette. 2. A little fan of THREE broad, plump spring leaves, light green center and two darker sea-green flanks, attached to one small rounded amber root bud. 3. A gathered bundle of just THREE chunky chestnut cattail seed heads, two thick green blades and a bold coral ribbon tied around the fat stems, compact and slightly diagonal, no thin grass clippings. 4. A half-rolled seafoam rush mat, big golden-green spiral end, broad coral belt, three broad woven raised bands suggested, no woven microtexture. BOTTOM ROW 5. A compact clump of three fat pale-gold radicle roots below three big shiny green leaves, a juicy intact plug ready to replant, wider and rounder than a seedling. 6. An elongated bank planting roll, two fat joined gold-green rolls with four thick curled teal leaves and one rounded orchid bud on top, no little sticks or thin roots. 7. A lush compact wetland planting kit, one large violet iris bloom and two round-topped cattails nestling in a fan of broad green leaves, the large leaves and flower make a valuable BIG sculptural mass growing straight from a small bound rootball. Practically no unapplied details. Bottom-right blank.
```

原图 `exec-815fd2a4-26e3-44e6-a693-8778a001f69c.png`，SHA-256 `396d830a360a6569f8e6e1e3a75ef22859d6771788885cfe1505b8681e447eb9`。以下裁框按 L1 至 L7 顺序给出原图像素 x、y、宽、高。

```json
[[115,101,193,328],[408,95,325,336],[766,65,358,388],[1150,136,362,290],[23,575,345,372],[389,573,360,363],[764,544,367,410]]
```

### 栈桥

```text
BOARDWALK & BOATWRIGHT FAMILY. Clear aqua/seafoam enamel, buttercream trim and coral-orange safety accents; use reduced smooth driftwood, almost no grain. The chain must read as different from warm-orange roof carpentry. TOP ROW 1. ONE thick curved little driftwood stave like a short rounded chunky stick, ivory end and beach-aqua side with one simple notch, no brittle splinters. 2. Two short broad smooth seafoam-blue dock boards overlapping crosswise, large rounded ends, a cream paint stripe. 3. A detachable panel of three rounded turquoise slats joined to an ivory cross rail into a single almost square dock square seen in perspective, exaggerated thick clean slats. 4. Cluster of two stout cream-and-aqua mooring posts with a fat coral collar tying them together; distinguish two large round tops at different heights. BOTTOM ROW 5. A compact pale turquoise gangway module with TWO fat corner posts and one broad cream rope arc along one side, rounded teal deck and one blush-orange cap; bold and uncomplicated. 6. A chunky mooring gate made of two large short teal bollards joined by an ivory top-bar, oversized coral life ring hung to one side, make a broad sturdy silhouette. 7. A ready-to-install landing kit, chubby rounded aqua canopy over a tiny buttercream deck frame, single coral flag accent and a wide ivory gangway, no boat, no scenery or raised platform separate from the actual object. Use really simple smooth bright toylike shapes with no tiny nails, ropes or texture noise. Bottom right transparent blank.
```

原图 `exec-a1c97a91-0128-42a7-8aea-1d328d3853fe.png`，SHA-256 `c61d13c83aff7832856762c2257084a82cce8d93f58d971bf0b25c1ad555ece8`。以下裁框按 L1 至 L7 顺序给出原图像素 x、y、宽、高。

```json
[[30,148,333,270],[393,119,359,284],[777,111,371,325],[1192,89,312,353],[25,616,341,343],[403,604,351,329],[775,537,360,429]]
```

## 河湾地标

泉眼、芦苇岸、船坞、芦苇圃和白鹭共十件，采用与棋子相同的圆润造型、亮面渐变和轻接触阴影。三次内置 ImageGen 调用均使用 `transparent_background: true`。风格输入为上述开发商截图与本项目已验收的 28 枚棋子浅蓝格图 `.preview/gossip-style/materials-48px-final.png`。前两次分别增加本项目此前绘制的泉眼图集 `exec-589475eb-a88e-47ec-acb1-daf953b62320.png`、芦苇岸图集 `exec-2b24a946-7f90-49cf-a84a-a8d6e23e5ecf.png` 作为地形和阶段位置参考。

前两张原图各 1254 × 1254，芦苇圃与白鹭的横图为 1774 × 887。WebP 最长边 480 像素，quality 91、alphaQuality 100。泉眼两态使用相同裁框与脚点 `[0.51, 0.76]`，上半部轮廓按二值 alpha 的交并比为 98.8%。地标在实际地面上以约 80 像素显示复核，各件脚点均存于 `dist/lite/b/river-metrics.mjs`。

三次调用均以此共用提示起始。

```text
Use case: stylized-concept. ORIGINAL POLISHED 2.5D CARTOON GAME ART, a handful of map landmarks for an upbeat tropical-coastal mobile merge adventure. Image 1 is a STYLE REFERENCE ONLY from the official casual merge game board: study the smooth glossy ordinary coffee cup, yellow bread, teal diving gear icons, NOT the promotional giant central lobster, text, characters or UI. Image 2 is our OWN final inventory; the map objects must belong in exactly the same game as those rounded orange trestles, cyan cistern, fat leaves and smooth teal dock. They must look almost sculpted from smooth clay coated with a gentle glaze. Rounded and plump, appealing strong silhouettes, noticeably simple warm-to-cool color blocks with a sweet luminous upper left and subtle dark colored edge. Every object or site is structured from a small number of LARGE curved pieces. No realistic photography, no rough brushwork, flaws, wood grain, moss speckles, mud spots, streaks of rust, fine grasses, hair roots, intricate mechanisms, tiny rivets, narrow flying leaves or microtexture. Clear major negative spaces, gentle pressure shadow where weight touches the ground, no depicted square or hex patio, circular platform, gray studio backdrop, white outline, glow, big oval shadow or labels. Native transparent alpha, outside contours must be fully clear; gaps must be transparent too. Intended to be actually readable on a phone at about 72px, a slightly elevated three-quarter camera from the front, directional light upper-left. Image 1 and 2 are NOT edit targets: no copies of their individual objects.
```

### 泉眼、引水槽、小船

```text
Image 3 shows the FORMER atlas solely for quadrant positions, visual subject and the matched spring rock layout. REDRAW ALL FOUR from scratch in the rounded simple board-item style of Images 1 and 2, remove every ounce of its previous realistic texture. Square 1254×1254 or 1536×1536 PNG. Exactly 4 isolated sprites, centered on a regular two-column, two-row atlas, no background between them, wide totally transparent gutters. TOP LEFT: blocked spring. Build this simple low recognizable site from only THREE candy-rounded lavender-gray boulders, warm pale peach sunward face and dusky slate shaded face, largest left-leaning upper rock over a small dark cave outlet at front-left. One plump pistachio moss curl on top and just ONE orange leaf plus two chubby blunt crossed golden twigs clogging the opening. No water. Avoid giant gravel beds: only two pea-sized pebble contacts at foot. TOP RIGHT: the very SAME THREE boulders, EXACTLY same shape, arrangement, camera, moss, scale, footing and center. Remove the sticks and leaf; from that same notch at front-left flow ONE thick clear ribbon of cheerful turquoise water diagonally towards lower-left, with one gracefully curved white ripple and a short natural tapered outlet, like the glossy water in our blue bowl. It should be immediately clear the same rock has been fixed. Total width/height of rock structure matches the first image. BOTTOM LEFT: installed irrigation flume shaped from ONE wide honey-orange hollow half-pipe, soft sand-colored rim, tiny turquoise water streak, two stout simple brown feet with ONE gold clamp near each. It slopes upper right to lower left. Rounded, clean, no lumber texture. BOTTOM RIGHT: a stout charming little stranded dinghy, beautifully rounded boat-shaped turquoise body, one ivory rim, large apricot seat with only ONE short spare plank and a simple rolled coral rope in its center. No sail, no land underneath. Hull points upper right. All these pieces are map landmarks, the only visual detail is the selected big colorful shapes. No lettering, effects, texture, coins, tile backgrounds or icons outside these four objects.
```

原图 `exec-6a84d3d1-7616-43e0-ab45-220b06161449.png`，SHA-256 `0b702032fc9108b4c98b48481892fdf97ddd60128e607faae8a99f547a990df9`。

```json
{"ruin-spring":[31,67,570,514],"scene-spring":[658,67,570,514],"v11-trough":[25,684,577,529],"v11-boat":[627,674,597,537]}
```

### 芦苇岸与半栈桥

```text
Image 3 is a FORMER atlas for subject, quadrant order and common landmark geometry only. REDRAW ALL FOUR as new cartoons in Image 2's glossy material style, discarding all its naturalistic fine leaves, mud texture and timber grain. Square 1254×1254 or 1536×1536 PNG, exactly four positions, two columns by two rows. Each site isolated on true transparency with ample clear gutters. TOP LEFT: damaged estuary reed bank, low asymmetric graceful silhouette extending lower-left to upper-right. Use only a group of TWO rounded sand-colored pale gray pebbles touching at the front left, ONE crooked short warm ochre twig at the right, and THREE broad flattened creamy-ochre bent leaves between; naked earth is just a narrow organic cinnamon shape under them, not a mound or slab, no pebbled texture. TOP RIGHT: the same bank, SAME front-left paired pebbles and right-hand crooked twig in the SAME position, the recovered planting in the middle now has a single compact silhouette of FOUR very FAT glossy green and turquoise blades and TWO rounded caramel cattail heads. Visible negative gaps, juicy soft light curve on the green blades. Transparent gaps between components. BOTTOM LEFT: restored mature shore, a somewhat WIDER growth on that SAME baseline and the recognizable pair of front-left stones. A cohesive rounded bushy group made of ONLY 7 generous teal/green leaf shapes, THREE big honeysuckle-colored cattail heads and ONE plump violet iris catching upper-left sun. Group leaves in stepped heights instead of many splintered spikes. Roots simplified to one muted ochre curve along the earth. No bird (it will be a separate animated sprite) and no water square. BOTTOM RIGHT: rebuilt first half of a short fishing pier with THREE broad pebble-edged seafoam/ivory decking slats on two chunky rounded beams, THREE chubby cream mooring posts; ONE wide clean rope arch linking two posts and ONE coral float. One exposed rounded wood end at upper-right so player sees the next component can attach. Pier slopes from bottom-left towards upper-right. Totally clean enamel-like smooth surfaces, playful recognizability, no rusty or worn paint or tiny nails. No boats or people, no text.
```

原图 `exec-6cc672d7-1164-48c5-892d-2f09aabb51f5.png`，SHA-256 `5a52e6aeaa80a303b4a097ea6158f9056e2a8b12050abaa46da1b0b25c9fde36`。

```json
{"ruin-reeds":[60,198,522,321],"scene-reeds":[649,66,544,454],"scene-shore":[35,617,591,557],"scene-pier":[627,612,591,606]}
```

### 芦苇圃与白鹭

```text
Create TWO original individual map sprites in one LANDSCAPE wide 2:1 atlas, a SINGLE ROW of TWO square invisible cells. Left object's center x25% y50%, right object's center x75% y50%. Leave wide clear transparent space between them and around each of the two entire silhouettes, fully visible. LEFT: a newly planted little original cattail nursery patch in a coastal orchard. It is a low compact fan of FOUR broad, plump leaf blades (spring green in sunlight, teal along bottom) with TWO pale immature yellow-green cattail buds, rooted at a subtly curved little cinnamon patch. A short low curved ochre bamboo retaining stave at the front right and TWO smooth grey pebbles at the front left distinguish it from a loose inventory seedling. Big bold silhouette of rosy-cheeked plump shapes, stylized, only 6 principal shapes, no pot or big nursery box, no wooden plinth, no thin linework or fine leaves. RIGHT: a SINGLE pure white cartoon little egret standing alert, in clean side view facing to the RIGHT with a gently upright S-curved neck, soft round creamy white breast, one clear pale-blue wing shadow shaped like a broad teardrop, a single small bright orange pointed beak, one tiny dark friendly eye, and two slightly bent short dark navy legs with clear simple feet. Preserve recognizability as a graceful egret while giving it the soft three-dimensional volume, clarity and charming polish of the regular board icons, NOT a realistic detailed bird; no stiff long matchstick legs, no open wings, no surrounding plants, rocks or water. Soft self-shading in icy blue beneath the wing, minimal warm reflected light, tiny contact shadow close to its feet, transparent background. Both original sprites must feel related to our glossy collectible images, not food or a website illustration. No circular pads or text.
```

原图 `exec-ff8c1b18-e8ef-4471-be53-768f751d480d.png`，SHA-256 `0fd73732cc28556de228fdc0eeb2470e48e4832efb0b681ebedf3b98c0c7e0a9`。

```json
{"v11-cattail":[135,121,607,633],"v11-egret":[1068,111,513,651]}
```

## 格边风暴残骸

漂木、断枝、碎石和断根由内置 ImageGen 单独绘制在一张 1254 × 1254 透明图集上。以真实草地底图检查 36、40、43 和 52 像素的显示高度。四帧分别裁切，保留长宽比，最长边 256 像素，WebP quality 91、alphaQuality 100。

```text
Use case: stylized-concept. Make one original transparent 2 by 2 atlas of FOUR DISTINCT ground debris sprites to scatter along individual cells in a cozy coastal-forest mobile merge game. Square canvas, four isolated groups centered within four equal quadrants. ATLAS FOR REAL GAMEPLAY, no scene or text. Three-quarter overhead orthographic view around 40° above ground, consistent warm upper-left daylight, tactile rounded shapes and broad painted shadow planes. Soft teal ambient shade, bright warm edges, refined hand-painted casual game style. Each cluster is very low, rests ON the ground, and reads at 36–54px. Wide asymmetrical silhouettes across imaginary ground, width ~1.8–2.4 times height. ZERO floor around them, true transparent RGBA cutout, perfectly clear empty space and gutters; ONLY a narrow faint dark contact immediately under the particular wood/pebbles or roots. No plaster backing, square, raised tile, uniform soil mound, central platform, scene, typography, glow, white halo, fake transparency pattern, leaf carpet, cropped objects or watermark. No human or living animal. All four should be visually incidental storm litter embedded in an environment, distinct from a neatly collected inventory item. Each is a cohesive small grouping, not a disconnected row of icons. Give every cluster a clean taper and at least 12% transparent padding within its cell. TOP LEFT: ONE squat piece of very weathered pale grey driftwood with a single bleached knot and short curved spur, slightly tapered diagonal from lower left to upper right, a dew-damp gold leaf and a loose russet leaf nestle at its side. TOP RIGHT: a scatter of four snapped slender cinnamon/acorn brown walking-stick-sized twigs and split kindling of different lengths and thicknesses, visible warm splintered ends, crossing informally and lying low in an asymmetrical loose wedge. They are NOT neatly parallel poles and there is NO cord tying them. BOTTOM LEFT: a compact scattering of five damp slate-blue and moss-gray rounded river pebbles, one larger smooth pebble next to a tiny muddy pebble with a broken green reed shoot/leaf slumped across two stones; tiny thin dark dampness under contact only, no puddle, no slab of soil. BOTTOM RIGHT: small tangled storm-torn roots exposed from a riverbank, three chunky chestnut roots twisting together loosely, one cut end, fine tips and one subdued dull-green moss fleck nearly touching the root; loose crown lying on its side. No trunk, tree, standing plant, upright cross, stump or container. Clean natural detail, separated colored silhouettes, original artwork.
```

原图 `exec-503cc111-fbe6-44ae-96d1-6eb391c930fb.png`，SHA-256 `ec535638e084ec4f5619fae4a80bf0a1f9c8c054661ce3da32ff7eaf8f459940`。

| 名称 | 源裁框 x, y, 宽, 高 | WebP 尺寸 |
| --- | --- | --- |
| bay-drift | 41, 178, 541, 308 | 256 × 146 |
| bay-kindling | 665, 212, 559, 270 | 256 × 124 |
| bay-silt | 47, 809, 519, 262 | 256 × 129 |
| bay-roots | 633, 805, 579, 275 | 256 × 122 |


## 地图木工生成器

倒木堆由三段原木与一把珊瑚柄斧头组成，炉火升级后变为矮木锯架、蓝绿手锯与烘干木束。两件使用同一张原创 1774 × 887 透明图集，内置 ImageGen 读取官方棋盘仅作画风参考，本项目最终材料图作色彩和造型参考。

```text
Use case: stylized-concept. Original game sprites for a cozy post-storm woodland rebuilding map. TWO consecutive states of a real working place in the world: a fallen LOG PILE with an AXE, then a LOW WOODEN SAWBUCK with a HAND SAW. Supplied Image 1 is a style reference of an official mobile merge board: look only at its ordinary rounded coffee cup, bread and diving items to understand the clear colorful 2.5D cartoon painting and light. Supplied Image 2 is our own already-approved material set and defines the smooth warm timber, teal tool colors, softly contrasting edges, simple specular strokes and rounded volume. Style references ONLY. Do not draw any object, food, interface, tile, label or scene from the reference. In particular: no toolbox, tool case, machine, generator box, crank wheel, metal workstation, factory or metal table. These are original physical objects that a family could use to split and saw wood after a storm. Show both in the same 3/4 elevated orthographic perspective, on their ACTUAL feet upon an invisible ground plane as two standalone transparent-alpha isometric environment sprites. Side-by-side landscape atlas, 2:1 aspect, exactly 2 isolated figures in one row, centers x25% and75%, center y50%, robust 12% fully clear margin on all sides of each half. Wide transparent gutter. Outer cutout must be crisp transparent, no colored poster, no atmosphere, no white glow, no tile of grass or land or rectangular disc behind them. Soft little contact shadows immediately below the actual lowest wood or feet. There is no generic big ellipse or plastic plinth. Use only a few bold generously rounded forms and big clean gradient fills. Warm upper left sun and light teal-blue shadow with thin colored contour at right/lower edges. Wood should feel like rounded honey/terracotta colored wood, one clean ring per end or two at most, smooth big highlights and substantial thickness, without tiny grain, speckles or scratches. Readable on a forest map when shrunk to 75 pixels; broad, pleasant, distinctive silhouettes. LEFT SPRITE: EXACTLY THREE short heavy naturally rounded cedar logs lying in an UNBOUND loose fallen pile on the ground, at least two long woody pieces touching the ground. One forward pale cream cut face visibly round with one orange ring. One chunky camping AXE is firmly embedded in the TOP log: a recognizable broad curved blue-gray steel axe blade on the middle log and a SINGLE coral-red wooden handle that rises diagonally to the upper-right. The axe is a prominent part of the silhouette, NOT some kind of orange duffel, handlebar or strap. A small branch nub on one rear log is enough to suggest the woodland. No saw, straps, tied rope, kit, bundle, base, grass, stones or high stump. RIGHT SPRITE: newly improved small cozy timber workshop made of a LOW SAWHORSE: two short thick crossed ochre timber supports and a simple crossbeam, a dry sawn log held on the supports, plus one small stack of **two golden dry boards together in a little warm coral fabric strap directly beside the front foot**; the boards physically rest on the ground, not a platform. One very clear broad hand SAW leans over or rests upon the sheathed rail: large turquoise loop-shaped handgrip on one end, smooth pale steel-blue tapering blade with only 3 or 4 large-rounded serrations along its working edge. Warm amber and chestnut trestle, cream end cuts, aquamarine hand saw with gleaming warm white edge, all faithful to the style refs. At least three distinct stout wooden foot contact points on the floor. Do not draw a circular saw, machine crank, power tool, cutting table, additional instruments, rail fences or completed shed. No text or watermark.
```

源图 `exec-349140cc-7a5a-4a31-8736-62ade5f7f6cc.png`，SHA-256 `75cfefe9a03ca0f7afddb73f496ea09a093f052c6dc3902479b044acf21fb28a`。

| 资源 | 源裁框 x, y, 宽, 高 | 素材在输出中的 x, y, 宽, 高 | 输出画布 | 既有脚点 |
| --- | --- | --- | --- | --- |
| sawbuck | 101, 134, 744, 636 | 6, 43, 289, 247 | 320 × 320 | 0.48, 0.76 |
| sawmill | 957, 140, 736, 643 | 7, 6, 306, 268 | 320 × 299 | 0.51, 0.79 |

分别选取三段木料接地投影中心与锯架支脚、侧面木束所围成的支承区中心作为原图脚点，再用透明边距注册到地图现有坐标。各坐标轴相对于既有脚点的取整偏差均小于 0.3 像素。

## 2026-11-19 · 河道与渡口工地

四件工地美术使用内置 ImageGen 和透明输出。试装件呈现现场装上可拆组件的完整状态。泊位的松绳扣和卷好的蓝篷固定在半栈桥上，通航后由系稳的蓝篷渡船、连船踏板与暖灯替换。试水用的短木槽直接卡在原泉石的出口，取回后可换回普通泉石。桥下的开口带 alpha，溪水由实际地图层提供。

编辑前查看本项目原有半栈桥、落成渡口、泉石、引水槽、断码头和过溪木桥，并对照前述开发商棋盘图。为保持位置，使用透明定位稿：半栈桥置于 1000 × 600 的 `[70,120,395,405]` 区域；原泉石置于 900 × 540 的 `[375,62,446,402]` 区域。后两次引水修订还对照了实际试水时显露的溪道落点。

下表位置指 1536 × 1024 底图上的**最终地脚**，已经包含垂直偏移。尺寸以一个六边半径 42.667 像素为单位。

| 工地状态 | 最终地脚（世界坐标） | 显示长边 | 图内脚点 |
| --- | --- | ---: | --- |
| 原半栈桥入口双桩 | 1270.8, 417.3 | 1.65 格半径 | 岸侧 UV 0.287, 0.947 |
| 临时泊位框架 | 1270.8, 417.3 | 3.95 格半径 | UV 0.121, 0.854 |
| 通航渡口 | 1270.8, 417.3 | 4.36 格半径 | UV 0.1125, 0.949 |
| 普通泉石 | 827.4, 416.5 | 2.40 格半径 | UV 0.51, 0.76 |
| 临时引水接口 | 827.4, 416.5 | 3.034 格半径 | UV 0.6132, 0.7633 |
| 双桥台木桥 | 625, 423.5 | 2.10 格半径 | UV 0.520, 0.630 |

渡口各态的入口双桩间距约 24.5 世界像素。按原半栈桥既有中心脚点绘制时，等效绘制足点为 `[1285.4,401.3]`。船体中部下方实测为海水。以原泉石顶部苔帽的边界和质心配准试装图，短水线尖端落在 `[748.8,425.1]`，位于试装显露段。木桥近、远桥头的接触中心在 `[597,450]`、`[653,397]` 左右；桥下 `[632.0,421.2]` 的木桥 alpha 为零，其下方的溪水不透明。

### 四次初始请求的共同结尾

```text
Production sprite for the continuous outdoor map of an original coastal restoration game. Use polished 2.5D casual illustration: generous rounded contours, softly modeled warm wood, cream highlights and teal accents, with a few connected construction details that make a real place for people. Readable as a single scene at about 100–160 pixels. Warm upper-left daylight, front-right colored form shadows, physically convincing supports. It will be layered ON TOP OF the real landscape and river painted by the game. All background and all spaces through the structure must be true transparent alpha, clean anti-aliased outer edges. No text, logos, people, UI, card, tile, printed marks, glowing border, floating island, backdrop, standalone display plinth or big cast drop shadow. Keep small occlusion shadows immediately below actual connections and feet. No rectangular patch of water, no bed of dirt or illustrated grass.
```

### 泊位临时框架

初始调用使用下面的正文，其后拼接共同结尾。

```text
Use case: precise-object-edit. Image 1 is the EDIT TARGET: our EXISTING partial pier, already placed on a wide transparent landscape canvas with a large clear area on the RIGHT for extending over the water. PRESERVE the location, size, cream pile caps, camera angle, original alternating short teal/ivory boards, rope handrail and coral buoy. Especially preserve the EXACT two nearest shore-side round golden piles and their footing on the lower-left. Image 2 is the design reference for the old blue ferry canopy (only its color/fabric). Image 3 is a style reference for clear ordinary mobile board items, never reproduce its content. Draw the NEXT INTERMEDIATE WORKSITE STATE, as if the boatwright just brought a timber frame and temporarily fitted it onto the existing vacant right side of the dock. A low airy RECTANGULAR MOORING FRAME of only two honey-timber outriggers and one crossbeam is actually fastened into the OUTER right-facing edge of the existing deck with one chunky brass pin. The frame protrudes RIGHT, out over the water in the currently transparent part of the canvas. Leave a generous visibly empty space within it through which actual game water will show. Very clear functional foreground: one CORAL mooring line remains loose, its cream/brass rope clasp unhooked and hanging, while a folded SKY-BLUE CANVAS ROLL lies flat and furled across the new outer rail; the canopy is not raised at all. No operating ferry, no boat, no lamp yet. It is an unmistakable partly fitted landing for a future ferry, joined to the turquoise deck, not a second kit or a boat floating beside it. The main heavy shore piles stay at the left, east/water is on the right; the farthest part of the new frame should extend roughly one existing pier width past those root posts. Side extension and empty bay should claim the RIGHT two-thirds of the final crop, with no painted terrain on the left. Keep sprite fully in frame on a WIDE transparent canvas.
```

最终原图 `exec-232d2b5a-849c-458a-a3b8-0aaccc71f552.png`，SHA-256 `5f2817555ebfb44c6ae0b43f78cb3da5e4cc50fd11dff07f3516eac6d4bf4888`。源尺寸 `1752 × 897`，源裁框 `[57,87,1601,779]`，WebP 尺寸 `640 × 311`。

### 通航渡口

初始调用使用下面的正文，其后拼接共同结尾。

```text
Use case: precise-object-edit. Image 1 is the EDIT TARGET: our EXISTING fixed half-pier placed on a wide transparent canvas with a generous free space to the RIGHT. Keep the exact same deck silhouette, camera angle, original alternating seafoam and ivory slats, rope rail, small coral buoy and TWO NEAREST ROUND SHORE-SIDE WOODEN PILES in their original positions, unchanged height and scale. The sole shore-side root of the finished composition is those two piles at the lower left. Image 2 is a reference for our blue-canopy ferry's identity, small golden lantern and coral pennant; its old jetty is not used in place of Image 1. Image 3 is only an art-language reference for clear ordinary game objects. Complete the physical working FERRY LANDING by expanding the construction to the RIGHT of Image 1, where the real bay water will be visible under it. Add a low warm-wood mooring crossbar physically bolted to the RIGHT edge of the outer landing with two broad support beams. A beautiful plump little TEAL-HULLED PASSENGER FERRY lies alongside the landing to the RIGHT, waterline flush with the base of the piles, bow upper right and cabin side to the player. It has a taut raised sky-blue fabric canopy on four simple posts, welcoming cream seat, one coral pennant. A SHORT CLEAR-IVORY BOARDING GANGPLANK significantly bridges the visible gap from dock edge into the boat entrance; it must TOUCH both dock and boat and be visibly usable. A taut mooring rope runs from a dock cleat to the bow and is visibly tied. Hang one WARM GOLDEN BOAT LAMP giving a contained amber light under the outer front canopy corner, charming in daylight with no bloom cloud. Cohesive installed scene, not a display of independent toy props. Two nearest shore piles on the left, boat distinctly over the water on the right; keep the negative space between the outer pier feet and the hull TRANSPARENT and very clear, with open water to its right. No raised plinth, sandy island or water slab. If showing any grounding at all restrict it to brief soft contact at the shore-side piles. The ferry and gangplank account for more than one existing pier width to the RIGHT of its shore posts. Keep all parts completely in frame.
```

最终原图 `exec-9a64e404-d6ab-4f6e-9983-e1629c49b3b1.png`，SHA-256 `9d944be635b30489cfa5b8ca1e01406de5ae052d299e6c5f75aec045fa3652da`。源尺寸 `1620 × 971`，源裁框 `[39,72,1541,761]`，WebP 尺寸 `640 × 316`。

### 临时引水接口

初始调用使用下面的正文，其后拼接共同结尾。

```text
Use case: precise-object-edit. Image 1 is the EDIT TARGET, our current exact three smooth violet-grey spring rocks and their green moss cap on the RIGHT HALF of a wide transparent canvas. It has free room to the LEFT. Hold that particular intact rock shape, landmark scale, three boulders, small low front stones, camera, moss position and center of the footprint, ideally identical pixel-for-pixel. Image 2 is our warm wooden irrigation-flume language, to be used only for the material and joint shape. Image 3 is a stylistic reference for legible bright map art, not a subject to reproduce. REPLACE ONLY the current broad turquoise spill at the rock opening with a physically fitted, removable TEMPORARY WATER FEED CONNECTION. Nest the high end of a half-round golden timber chute snugly right UNDER the existing dark spring cleft at the front-left face of the rocks. One prominent simple copper U-collar (or coral clamp) secures the upper end to a little short brace against the stone; the mouth of chute and opening must visibly overlap and connect. The chute runs LEFT and only slightly down, crossing part of the empty canvas to the left, and it tapers toward a moderate, shallow lower outlet at the front-left, supported by one low bracket on a smooth stone foot. At this stage only a NARROW modest ribbon of CYAN water runs from the cleft INSIDE the chute; at its left end the trickle slips down briefly towards the LEFT into the real stream bed, narrow tapered organic tip, no pool. This part visually reads as an engineering test that can be unclamped; no broad gush, waterfall or large sluice. The actual three rocks are still the main landmark and should be on the right half of the crop. Add no land base or new scenery; the stones, attached channel and brief test flow are one non-floating washed-in installation. Centered on a WIDE transparent canvas, with all contours contained.
```

定稿前的针对性修订：

```text
Use case: precise-object-edit. Edit INPUT 1, the transparent illustration of our stone spring and attached temporary flume. This correction is about FITTING INTO THE EXISTING GAME RIVER. INPUT 2 is our original three mossy spring rocks and confirms their EXACT geometry. INPUT 3 is only a rounded mobile-art STYLE reference, never draw its objects/UI. Keep the boulders, moss, copper connector and viewpoint exactly the same in the new illustration. Important change: SHORTEN the previously very long left-projecting wooden gutter to NEARLY HALF ITS LENGTH and bring its outlet UP. Form a SHORT installed coupling that points ALMOST HORIZONTALLY DIRECTLY TO THE LEFT, not steeply toward the viewer. The lower tip of the tiny trickle must end ABOUT LEVEL WITH THE MIDDLE OF THE LEFT SMALL FRONT PEBBLE or slightly above that pebble, NOT well below the main rocks. This determines where it connects to the game’s real stream. Keep the source rock in the right part of a wide transparent composition. The clamp is directly under the mouth feeding a slim turquoise test ribbon into a handsome short timber chute, running more than 85% left and less than 15% down; a single very LOW supporting bracket and a small crooked flat sliver of warm stone under the outer lip at LEFT ground it in the same terrain. The trough is about HALF A ROCK CLUSTER'S WIDTH by projection, chunky and practical rather than a long walkway. Tip: one tiny 1–2cm splash over the lip that flows LEFT almost horizontally and fades cleanly onto transparent alpha; absolutely no dangling vertical waterfall or long tail. Keep a visible open clasp detail to show it is temporarily attached. New working installation = object ONE, actually joined, resting at its stone spring outlet. Very clean softly rounded 2.5D contours, broad lovely shaded shapes, actual transparent gaps, same warm left light. NO solid backdrop, no riverbed tile, no ground island, dark backdrop, text, props apart from those described or large shadows. All contours fully in frame.
```

最终水线根据河床位置再做局部编辑。定位稿为 604 × 431，编辑目标保持透明，第二份参考图的洋红标记只用于指出接水位置。

```text
Use case: precise-object-edit. Image 1 is the actual transparent asset to edit. Image 2 is a technical POSITION GUIDE only: it shows the EXACT SAME ART and a little magenta ring indicating the position of a real water channel that will be rendered under the sprite. Single localized edit: replace the two tiny sideways blue droplets at the very LEFT LIP of the timber water chute with ONE connected narrow arcing streamlet. It must emerge from the tiny notch on the left lip, flowing LEFTWARD for a little distance and then CURVING GENTLY DOWN and leftwards through the previously empty region so its tiny tapered tail ends at the CENTER OF THE MAGENTA TARGET shown in Image 2. In source pixels this goes from near (100,300) to near (47,351) on the 604×431 transparent canvas. Gentle, narrow, lively turquoise test trickle, 4-8 source pixels in typical width, with one pale blue highlight. This should look like a small amount of water falling from a spout into the real creek that will already be there, not a broad waterfall or pond. Keep the locations, scale, viewing angle and silhouettes of ALL existing stones, timber chute, central clamp, tiny front pebbles and supports UNCHANGED. Render the WHOLE identical asset plus this tiny curved pour; do not repaint or recompose the rest. Leave generous transparent margins all around the entire silhouette. The technical magenta ring, its color, and the example green backdrop must NOT appear in the output. No scene background, ground base, imagery under the tip, text, guide arrows, extra rocks or glow. True alpha transparency everywhere outside the object and thin test stream.
```

最终原图 `exec-6adb2b33-91af-4d3a-b5c6-b440a825136c.png`，SHA-256 `c02c2ed9c97ed4441f7d7007b050ea9ef39e6daf56c0d90867a705498c7326ca`。源尺寸 `1485 × 1059`，源裁框 `[111,41,1327,942]`，WebP 尺寸 `520 × 369`。

### 双桥台木桥

初始调用使用下面的正文，其后拼接共同结尾。

```text
Use case: stylized-concept. Make a newly drawn outdoor FOOTBRIDGE THAT ACTUALLY SPANS AN EAST-WEST STREAM on an illustrated coastal map. Image 1 gives the old wooden bridge's material and restrained teal post-cap identity, but you must CHANGE ITS PROJECTED ORIENTATION and make room for the real stream to be seen under it. Image 2 gives the existing flume's timber color. Image 3 is a style guide only for the usual polished colored rendering. Show one modest graceful, physically anchored timber footbridge over NOTHING (actual game water is a separate layer). The walkable deck runs from LOWER LEFT/NEAR bank to UPPER RIGHT/FAR bank, crossing the painting predominantly VERTICALLY. The horizontal movement between its near and far landing centers should be only about ONE-HALF the VERTICAL movement; i.e. the bridge runs up the image from 7 o'clock to 1 o'clock, rather than across it. Clearly portray two separate bridgehead thresholds with a short, flat grey stone footing and a minute tuft directly at each landing: one threshold in the lower-left foreground, the other on the upper-right bank. The footings touch opposite banks in the game. No water painted below. The honey-colored deck gently bows up, just five or six broad inviting planks, with a neat low curving handrail and a few solid short posts with muted teal caps on the outside edges. Show a clean prominent OPEN ARCH UNDER THE DECK from the exposed front-right side, with real transparent background visible through the opening; no central ground post, no plank skirt, black fill, blue paint under the bridge, black cast shadow or stylized river. Give the two distinct support feet tangible weight through compact stone/moss at the two ends only. Compact, substantial timber structure, a usable permanent footbridge in a forest, no giant ornate props. Slightly elevated three-quarter camera, retain a strong visible upper walking surface AND show right hand arch with a generous open transparent span. No clipping or cropped vegetation, no link to any pictured surrounding diorama. Actual alpha transparent sprite, medium portrait framing to allow a steeper bridge.
```

定稿前的针对性修订：

```text
Use case: precise-object-edit. Strengthen the structure of Image 1, a golden timber forest bridge in the correct projected direction from lower left front landing to upper right back landing. Image 2 gives its project shape/colors, Image 3 only the mobile polish/craft style. This is a transparent map sprite placed over an EXISTING EAST–WEST FLOWING RIVER; the player needs to SEE THEIR ACTUAL RIVER DIRECTLY THROUGH AN OBVIOUS OPEN ARCH UNDER THE BRIDGE. The current ramp hugs the ground too tightly. RAISE THE SHORT WOODEN DECK ON TWO NOTICEABLE LOW STONE BRIDGE ABUTMENTS at the banks (only at the ends). Keep the longitudinal direction up and to the right; the far landing's threshold should be well above and a little right of the near landing, about 7 o'clock to 1 o'clock in the image. Use an elegant single span of curved caramel timber: its right, viewer-facing longitudinal load-bearing arch rises CLEAR of both bank footings and the bottom curvature makes a substantial CLEAR THROUGH-OPENING with free TRANSPARENT ALPHA under its center. Give the distant bank block a low foot and a visible inward face; raise the near bank block enough that you can see a good patch of clear transparency BETWEEN these supports and UNDER the center of the bridge instead of an opaque brown ramp. Broad arch, no intermediate pier or diagonal infill beneath the deck. The actual map will show blue water through this region when installed; DO NOT paint any water, blue or black fill into it. This is a small installed footbridge, with usable warm wooden deck, low rounded green-capped handrail, one little cream stone threshold at each end, and gently peaked 3/4 ground perspective, no central raised island. Reduce massive side rails and widen the visible void; keep enough of the deck surface to read its walking direction. All grass limited to two tiny tufts touching the stone ends. The viewer must see the two threshold anchors and unmistakable arch at 75 pixels. Keep the same near-upright overall composition from Image 1 while increasing the space under the longitudinal side. No text, labels, particles, water-plane, land-strip, board UI, backdrop or cast shadow filling the arch. Crisp transparent alpha.
```

最终原图 `exec-a9f92f31-be63-4449-95d5-220ef797ea73.png`，SHA-256 `ce4361f0c538569748a653909c75aa77c65d371dcca54d393d543d959a44aa09`。源尺寸 `1221 × 1288`，源裁框 `[16,28,1179,1208]`，WebP 尺寸 `508 × 520`。

试装接口的初稿与第二稿原图为 `exec-aba08e44-cd6e-4835-bb85-f6dbe19da7f3.png`、`exec-7d078cdb-acf1-4a67-95f0-e6080a38af2d.png`；过溪桥首稿为 `exec-77f08e4d-1bfb-4a0d-84d4-742e29b0eb37.png`。四件运行时成品均采用保留抗锯齿边缘的 WebP，quality 91、alphaQuality 100。
