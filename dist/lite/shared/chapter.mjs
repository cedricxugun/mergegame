// Chapter one, shared by both prototypes: the repairs, their art, story
// beats and the grandmother's diary. Each prototype layers its own economy
// (rewards, unlocks) on top of these ids.
export const CAST = {
  mira: {name: '米拉', role: '带着女儿回乡的木匠'},
  lina: {name: '莉娜', role: '米拉的女儿'},
  rowan: {name: '罗恩', role: '撑渡船的老朋友'}
};

// art: finished scene; ruin: what stands there before (null = empty ground).
// replaces: an earlier repair on the same spot whose art this one supersedes.
export const REPAIRS = [
  {id: 'roof', spot: 'shelter', chain: 'wood', level: 3, title: '补好漏雨的棚顶', ruin: 'ruin-shelter', art: 'scene-roof', after: [], reveal: 2.4,
    lines: [['lina', '雨都落在外面了！妈妈你看，地板是干的。'], ['mira', '先有个能睡觉的地方。明天生火，再去看看旧路。']]},
  {id: 'fire', spot: 'hearth', chain: 'wood', level: 4, title: '搭起炉架，生一堆火', ruin: 'ruin-hearth', art: 'scene-fire', after: ['roof'], reveal: 2.2,
    lines: [['mira', '火生起来了。湿衣服、湿木头，都能烤干了。'], ['lina', '我把外婆的灯也点上，挂在门口。对岸的人就能看见我们了。']]},
  {id: 'fence', spot: 'fence', chain: 'wood', level: 4, title: '把外婆的菜园围起来', ruin: null, art: 'v11-fence', after: ['fire'], reveal: 2,
    lines: [['lina', '外婆以前就在这里种菜！我记得这根歪歪的柱子。'], ['mira', '先把围栏立起来。等有了水，再把菜园种回来。']]},
  {id: 'path', spot: 'path', chain: 'wood', level: 5, title: '撑起倒木，接通旧路', ruin: 'ruin-path', art: 'scene-path', after: ['roof'], reveal: 2.6, opens: ['creek', 'river'],
    lines: [['lina', '路通了！下面就是那条干掉的小溪。'], ['mira', '小溪从上游的泉眼来。泉眼堵住了，溪就干了。'], ['lina', '再往东走，就是芦苇河湾和渡口！']]},
  {id: 'spring', spot: 'spring', chain: 'water', level: 4, title: '疏通石缝里的泉眼', ruin: 'ruin-spring', art: 'scene-spring', after: ['path'], reveal: 2.4,
    lines: [['lina', '水冒出来了！冰冰凉凉的。石头里真的有人在唱歌。'], ['mira', '那是你外婆说的话……她总说，泉眼是这片林子的心跳。']]},
  {id: 'trough', spot: 'trough', chain: 'water', level: 4, title: '架起引水槽', ruin: null, art: 'v11-trough', after: ['spring'], reveal: 2,
    lines: [['mira', '引水槽搭好了，水能顺着槽流进旧溪道。'], ['lina', '可是溪道太干了，水一流进去就渗没了……要更多的水。']]},
  {id: 'stream', spot: 'spring', chain: 'water', level: 6, title: '让小溪流回营地', ruin: null, art: 'scene-spring', after: ['trough'], reveal: 4.2, creek: true,
    lines: [['lina', '小溪回来了！一直流到营地门口！'], ['mira', '听，水声。这片林子终于有声音了。'], ['lina', '外婆的菜园可以浇水了！']]},
  {id: 'cattail', spot: 'cattail', chain: 'reed', level: 3, title: '在湖边育一圃芦苗', ruin: null, art: 'v11-cattail', after: ['path'], reveal: 1.8,
    lines: [['lina', '芦苗圃！等它们长大，就能种到河岸上去。']]},
  {id: 'reeds', spot: 'reeds', chain: 'reed', level: 4, title: '给松动的河岸种回芦苇', ruin: 'ruin-reeds', art: 'scene-reeds', after: ['path'], reveal: 2.4,
    lines: [['mira', '草垫压稳了，根就有时间长进泥土。河岸不会再塌了。'], ['lina', '我在外圈摆了小石头，提醒大家别踩到刚种下的芦苇。']]},
  {id: 'garden', spot: 'garden', chain: 'reed', level: 4, title: '给外婆的花箱种回花苗', ruin: null, art: 'env-flowers', after: ['stream', 'fence'], reveal: 2.2,
    lines: [['lina', '我把花苗一棵一棵种下去了。外婆的花箱，又开花了。'], ['mira', '她最喜欢这种白花。等她回来，一定第一个看见。']]},
  {id: 'pier', spot: 'dock', chain: 'dock', level: 5, title: '接上断开的栈桥', ruin: 'ruin-dock', art: 'scene-pier', after: ['reeds'], reveal: 2.6,
    lines: [['rowan', '米拉！我在对岸看见营地的灯了。这几天大家一直在等。'], ['mira', '罗恩！栈桥接上了，你的船能靠岸了吗？'], ['rowan', '还差一点。等泊位修好，我把邻居们一船一船接回来。']]},
  {id: 'bridge', spot: 'bridge', chain: 'dock', level: 4, title: '在小溪上搭一座木桥', ruin: null, art: 'scene-stream', after: ['stream'], reveal: 2.2,
    lines: [['mira', '有了桥，就不用踩着石头过溪了。'], ['lina', '我要站在桥上看小鱼！']]},
  {id: 'shore', spot: 'reeds', chain: 'reed', level: 6, title: '让根系连成护岸绿带', ruin: null, art: 'scene-shore', after: ['reeds', 'cattail'], reveal: 3.2,
    lines: [['lina', '白鹭回来了！它站在芦苇旁边，一点也不着急。'], ['mira', '河岸安稳了。鸟回来了，人也就快回来了。']]},
  {id: 'jetty', spot: 'jetty', chain: 'dock', level: 4, title: '搭一座钓鱼台', ruin: null, art: 'v11-jetty', after: ['pier'], reveal: 2,
    lines: [['rowan', '钓鱼台！你外婆以前最爱坐在这儿，一坐就是一下午。'], ['lina', '罗恩叔叔，外婆……她现在在哪里？'], ['rowan', '……等渡口修好，我把她的信交给你们。']]},
  {id: 'home', spot: 'shelter', chain: 'wood', level: 6, title: '把棚子修成木屋', ruin: null, art: 'scene-home', after: ['fire', 'fence', 'path'], reveal: 3.2, replaces: 'roof',
    lines: [['lina', '床、屋顶，还有门口的灯！这里可以叫作家了吗？'], ['mira', '可以。外婆回来的时候，也有地方歇脚了。']]},
  {id: 'ferry', spot: 'dock', chain: 'dock', level: 6, title: '修好归乡的渡口', ruin: null, art: 'scene-ferry', after: ['pier', 'shore'], reveal: 3.6, replaces: 'pier', letter: true,
    lines: [['rowan', '缆绳系好了。第一船邻居到了！'], ['lina', '我们留的那盏灯，真的把大家带回来了！'], ['rowan', '米拉，这是你妈妈托我带来的信。风暴那天晚上，她去了山坡。']]},
  {id: 'feast', spot: 'hearth', chain: 'water', level: 5, title: '煮一大锅团圆汤', ruin: null, art: 'v11-cookfire', after: ['ferry', 'home'], reveal: 4.2, replaces: 'fire', finale: true,
    lines: [['mira', '汤煮好了。来，大家都过来。'], ['rowan', '好久没有这么热闹了。'], ['lina', '妈妈，明天我们去山坡吧。去找外婆。']]}
];
export const repairById = id => REPAIRS.find(r => r.id === id);
export const REGION_OF_REPAIR = Object.fromEntries(REPAIRS.map(r => [r.id, {shelter: 'camp', hearth: 'camp', fence: 'camp', garden: 'camp', path: 'camp', spring: 'creek', trough: 'creek', bridge: 'creek', cattail: 'river', reeds: 'river', dock: 'river', jetty: 'river'}[r.spot]]));

// What a spot shows: the newest finished repair there, else its ruin.
export function spotArt(done, spot) {
  const here = REPAIRS.filter(r => r.spot === spot);
  const finished = here.filter(r => done.includes(r.id));
  if (finished.length) return {art: finished.at(-1).art, done: true, repair: finished.at(-1)};
  const ruin = here.find(r => r.ruin);
  return ruin ? {art: ruin.ruin, done: false, repair: ruin} : null;
}

export const LETTER = {from: '妈妈', to: '给米拉', text: '风暴那晚，山坡的信号灯熄了。我上山去把灯点亮，渡船才能找到回家的方向。灯塔里有点冷，但我很好。等你把家修好，就上来找我。'};

export const DIARY = [
  '搬进林子的第一年，屋顶漏了十七次。他说，漏一次就补一次，补着补着，就成了家。',
  '泉眼是米拉五岁那年找到的。她蹲在石头边听了一下午，说石头里有人在唱歌。',
  '溪水流过营地那年，我们在岸边种了一排芦苇。根扎稳了，河岸就不会塌。',
  '罗恩第一次撑船，把桨弄丢了。我们沿着河找了三天，最后是白鹭带的路。',
  '每次起风暴，我都去山坡上点信号灯。灯亮着，渡口的人就知道往哪边划。',
  '米拉去城里的那天，说一定会回来。我把门口那盏灯擦得很亮。',
  '如果你在读这页，说明风暴又来过了。别怕。先修屋顶，再生火，剩下的慢慢来。',
  '灯塔的钥匙，我放在——（后面的字被雨水洇开了）'
];

export const INTRO = [
  ['mira', '风暴把渡口冲断了，邻居们都在河对岸。外婆的守林小屋……也漏雨了。'],
  ['lina', '外婆不在家吗？'],
  ['mira', '我们先把这里修好。修好了，大家就有地方回来。']
];
export const OUTRO = {title: '第一章 · 归乡', text: '营地有了屋顶和炉火，小溪流回来了，渡口重新迎来了归人。山坡上的信号灯还没亮——外婆在那里等着。', next: '第二章 · 山坡灯塔（敬请期待）'};
