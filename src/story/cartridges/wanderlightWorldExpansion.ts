import type { CharacterDefinition, CharacterVisualIdentity, DemoTurn, DeterministicChoiceTurn, Locale, MapNode } from '../types'

const GOUACHE = 'EDITORIAL GOUACHE PAINTING, opaque matte brush shapes, visible dry-brush edges, simplified but observant adult features, deep indigo, mineral teal, sage and warm copper palette, sophisticated contemporary travel illustration, no glossy 3D, no photorealism'

const identity = (appearance: string, traits: string[], wardrobe: string[], forbidden: string[]): CharacterVisualIdentity => ({
  status: 'queued', version: 1, source: 'authored', appearance,
  immutableTraits: traits, wardrobe, forbiddenDrift: forbidden,
})

export interface WanderlightTravelDestination {
  nodeId: string
  label: string
  intent: string
  arrivalChoices: string[]
}

export function wanderlightExpansionCharacters(locale: Locale): CharacterDefinition[] {
  const zh = locale === 'zh'
  return [
    {
      id: 'iona-calder', name: zh ? '伊奥娜·考德' : 'Iona Calder', role: zh ? '35 岁 · 风崖天气观测员' : 'Age 35 · cliff weather observer', vitality: 71, stress: 29, hiddenUntilIntroduced: true,
      skills: [{ id: 'weather-reading', label: zh ? '读风' : 'Reading weather', value: 5 }, { id: 'signal-work', label: zh ? '信号维护' : 'Signal work', value: 4 }],
      detail: zh ? '在风玻璃崖维护信号塔，用风筒和盐镜记录沿岸天气。' : 'Maintains the Windglass signal tower and records coastal weather with windsocks and salt mirrors.',
      lore: zh ? '她正在核对一段与罗温旧地图对不上的海岸记录。' : 'She is checking a stretch of coast that does not match Rowan’s old map.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult woman age 35, tall compact build, deep brown skin, shaved head with one narrow silver-gray braid at the left temple, steady amber-brown eyes, weathered teal signal coat, ochre scarf, small brass wind-vane pin, natural adult anatomy, no text.`,
        ['age 35 adult presentation', 'deep brown skin', 'shaved head with one narrow silver-gray braid at left temple', 'amber-brown eyes', 'small brass wind-vane pin'],
        ['weathered teal signal coat', 'ochre scarf', 'dark practical layers'],
        ['teen appearance', 'long loose hair', 'missing temple braid', 'military uniform', 'glossy science-fiction suit', 'anime proportions'],
      ),
    },
    {
      id: 'luc-maren', name: zh ? '卢克·马伦' : 'Luc Maren', role: zh ? '33 岁 · 渡船与水闸修理师' : 'Age 33 · ferry and lock mechanic', vitality: 86, stress: 34, hiddenUntilIntroduced: true,
      skills: [{ id: 'mechanics', label: zh ? '机械修理' : 'Mechanics', value: 5 }, { id: 'tidework', label: zh ? '潮水判断' : 'Tidework', value: 3 }],
      detail: zh ? '负责芦水渡村的小渡船和木水闸，习惯把风险说得很具体。' : 'Keeps Reedwater’s small ferries and wooden lock gates working, and names risks plainly.',
      lore: zh ? '他知道一条在月线停运时仍能通往潮汐群岛的水路。' : 'He knows a water route that can still reach the Tidal Islands after Moonline service stops.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult man age 33, broad practical build, warm tan skin, wavy black hair cut above the collar, short neat beard, pale scar through the right eyebrow, rust-red work vest over rolled indigo sleeves, green enamel wrench tag, natural adult anatomy, no text.`,
        ['age 33 adult presentation', 'warm tan skin', 'wavy black hair above collar', 'short neat beard', 'pale scar through right eyebrow', 'green enamel wrench tag'],
        ['rust-red work vest', 'rolled indigo sleeves', 'waxed canvas trousers'],
        ['teen appearance', 'clean-shaven face', 'missing eyebrow scar', 'formal suit', 'ship captain uniform', 'exaggerated anatomy'],
      ),
    },
    {
      id: 'noor-bell', name: zh ? '诺尔·贝尔' : 'Noor Bell', role: zh ? '32 岁 · 公共浴场管事与流动厨师' : 'Age 32 · public bath steward and traveling cook', vitality: 78, stress: 23, hiddenUntilIntroduced: true,
      skills: [{ id: 'hospitality', label: zh ? '照料' : 'Hospitality', value: 5 }, { id: 'negotiation', label: zh ? '讲价' : 'Negotiation', value: 3 }],
      detail: zh ? '在白浪浴镇安排洗衣、热水和公共厨房，也随沿线集市做饭。' : 'Coordinates laundry, hot water, and the public kitchen at Whitecap Baths, and cooks at markets along the line.',
      lore: zh ? '诺尔保留着每场沿线演出留下的无字餐牌，能认出塞莱斯特的布台习惯。' : 'Noor keeps the blank meal tokens left by traveling shows and recognizes Celeste’s staging habits.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult person age 32, soft sturdy build, medium olive skin, thick dark curls gathered in a high cloth wrap with one curl loose at the right cheek, gray-green eyes, cream work shirt, plum apron, turquoise ceramic ladle pin, natural adult anatomy, no text.`,
        ['age 32 adult presentation', 'medium olive skin', 'dark curls in a high cloth wrap', 'one curl at right cheek', 'gray-green eyes', 'turquoise ceramic ladle pin'],
        ['cream work shirt', 'plum apron', 'soft charcoal trousers'],
        ['teen appearance', 'uncovered long straight hair', 'missing ceramic pin', 'chef toque', 'luxury robe', 'anime proportions'],
      ),
    },
    {
      id: 'eden-shaw', name: zh ? '伊登·肖' : 'Eden Shaw', role: zh ? '41 岁 · 石坑园艺师与石工' : 'Age 41 · quarry gardener and stoneworker', vitality: 83, stress: 20, hiddenUntilIntroduced: true,
      skills: [{ id: 'stonework', label: zh ? '石工' : 'Stonework', value: 5 }, { id: 'cultivation', label: zh ? '梯田栽培' : 'Terrace growing', value: 4 }],
      detail: zh ? '把废弃采石坑改成分层花园，也替远灯研修院修复旧石件。' : 'Has turned an abandoned quarry into terraced gardens and restores old stonework for Far Lantern Institute.',
      lore: zh ? '他在石层里发现过会对月光升温的矿脉，却拒绝把位置卖给投机者。' : 'He found a seam of stone that warms under moonlight and refuses to sell its location to speculators.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult man age 41, lean weathered build, fair freckled skin, shoulder-length iron-gray hair tied low, clean-shaven angular face, moss-green eyes, charcoal stoneworker smock, pale clay gloves, square copper measuring pendant, natural adult anatomy, no text.`,
        ['age 41 adult presentation', 'fair freckled skin', 'shoulder-length iron-gray hair tied low', 'moss-green eyes', 'square copper measuring pendant'],
        ['charcoal stoneworker smock', 'pale clay gloves', 'moss-colored undershirt'],
        ['young adult appearance', 'black cropped hair', 'large beard', 'missing copper pendant', 'fantasy armor', 'exaggerated anatomy'],
      ),
    },
    {
      id: 'nessa-rill', name: zh ? '妮莎·里尔' : 'Nessa Rill', role: zh ? '27 岁 · 沿线邮递员' : 'Age 27 · coastal route courier', vitality: 76, stress: 36, hiddenUntilIntroduced: true,
      skills: [{ id: 'route-memory', label: zh ? '邮路记忆' : 'Route memory', value: 5 }, { id: 'discretion', label: zh ? '守密' : 'Discretion', value: 4 }],
      detail: zh ? '乘月线和渡船递送信件、小包裹与失物，不替收件人解释内容。' : 'Carries letters, parcels, and lost property by Moonline and ferry without interpreting them for recipients.',
      lore: zh ? '她的邮袋里有一件地址被雨洗掉的包裹，封绳来自云阶果园。' : 'Her mailbag holds one rain-washed parcel tied with cord from Cloudstep Orchard.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult woman age 27, wiry athletic build, light brown skin, straight black hair in a chin-length blunt cut, white streak above the left brow, dark hazel eyes, cropped mustard rain cape, navy courier satchel with three plain copper buckles, natural adult anatomy, no text.`,
        ['age 27 adult presentation', 'light brown skin', 'chin-length blunt black hair', 'white streak above left brow', 'navy courier satchel with three copper buckles'],
        ['cropped mustard rain cape', 'navy work layers', 'weathered leather boots'],
        ['teen appearance', 'long braided hair', 'missing white streak', 'more or fewer than three satchel buckles', 'military uniform', 'anime proportions'],
      ),
    },
  ]
}

export function wanderlightExpansionMap(locale: Locale): MapNode[] {
  const zh = locale === 'zh'
  const s = (cn: string, en: string) => zh ? cn : en
  return [
    {
      id: 'windglass-cliffs', label: s('风玻璃崖', 'Windglass Cliffs'), connectedTo: s('远灯研修院', 'Far Lantern Institute'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('海崖上的天气站、信号塔和旧路线标记俯瞰整条海岸。', 'A cliff weather station, signal tower, and old route markers overlook the coast.'),
      routeHints: zh ? ['风玻璃崖', '风崖', '信号塔', '天气站', '盐镜', '海崖'] : ['Windglass Cliffs', 'cliffs', 'signal tower', 'weather station', 'salt mirrors', 'sea cliff'],
      facts: [s('信号塔雇人更换风筒和擦洗盐镜', 'The signal tower hires help replacing windsocks and cleaning salt mirrors'), s('值夜观测员正在核对旧海岸地图', 'The night observer is checking an old coastal map'), s('工人厨房和塔下客舍在恶劣天气中保持开放', 'The workers’ kitchen and tower guesthouse stay open in bad weather'), s('崖下新露出的路线标记可能改变月线时刻', 'Newly exposed route markers below the cliff may change Moonline schedules')],
    },
    {
      id: 'reedwater-crossing', label: s('芦水渡村', 'Reedwater Crossing'), connectedTo: s('潮汐群岛', 'Tidal Islands'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('浅河、木水闸和小渡船组成的低地村落，水路会随潮位改变。', 'A lowland village of shallow channels, wooden lock gates, and small ferries whose routes change with the tide.'),
      routeHints: zh ? ['芦水渡村', '芦水', '渡村', '水闸', '渡船', '浅河', '船坞'] : ['Reedwater Crossing', 'Reedwater', 'crossing', 'lock gate', 'ferry', 'shallow channel', 'boatyard'],
      facts: [s('船坞按完成的修补件结算短工', 'The boatyard pays by completed repair'), s('一扇卡住的水闸正在影响群岛补给船', 'A jammed lock gate is delaying supply boats to the islands'), s('渡口厨房每天把剩余食物做成公共晚餐', 'The ferry kitchen turns leftovers into a public supper'), s('涨水后旅客会在闸屋楼上过夜', 'Travelers sleep above the lock house after the water rises')],
    },
    {
      id: 'whitecap-baths', label: s('白浪浴镇', 'Whitecap Baths'), connectedTo: s('杯影夜市', 'Cupshadow Market'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('围绕温泉洗衣房、公共浴场和沿线厨房形成的小镇。', 'A small town built around spring-fed laundries, public baths, and a route kitchen.'),
      routeHints: zh ? ['白浪浴镇', '浴镇', '公共浴场', '洗衣房', '温泉', '蒸汽露台'] : ['Whitecap Baths', 'bath town', 'public baths', 'laundry', 'hot spring', 'steam terrace'],
      facts: [s('洗衣房按篮结算，公共浴场按班次招人', 'The laundry pays by basket and the baths hire by shift'), s('失物架上常有夜市演出留下的物件', 'The lost-property shelves often hold items left by market performers'), s('公共厨房欢迎用劳动换餐但会先说清条件', 'The public kitchen accepts work for meals only after stating the terms'), s('蒸汽露台是沿线旅客交换消息的地方', 'The steam terrace is where route travelers exchange news')],
    },
    {
      id: 'old-quarry-gardens', label: s('旧石坑花园', 'Old Quarry Gardens'), connectedTo: s('远灯研修院', 'Far Lantern Institute'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('废弃采石坑被改成层层花园、石工棚和蓄雨池。', 'An abandoned quarry remade as terraced gardens, stone sheds, and rain pools.'),
      routeHints: zh ? ['旧石坑花园', '石坑', '梯田花园', '石工棚', '蓄雨池', '石阶'] : ['Old Quarry Gardens', 'quarry', 'terraced gardens', 'stone shed', 'rain pool', 'stone steps'],
      facts: [s('修石阶、清水渠和搬苗都按完成量结算', 'Step repair, channel clearing, and seedling work pay by completed amount'), s('远灯研修院正在等待一批修复用旧石件', 'Far Lantern Institute is waiting for restored stone pieces'), s('公共灶台每天用花园收成做一锅热汤', 'The shared stove makes one pot of soup from the garden harvest each day'), s('一段月光会升温的石层被刻意留在原处', 'A seam of moon-warmed stone has deliberately been left in place')],
    },
    {
      id: 'cloudstep-orchard', label: s('云阶果园', 'Cloudstep Orchard'), connectedTo: s('银叶葡萄丘', 'Silverleaf Vineyard'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('果树沿海坡分层种植，夜间用低灯引导授粉蛾。', 'Fruit trees climb the sea slope in terraces, with low lamps guiding pollinating moths at night.'),
      routeHints: zh ? ['云阶果园', '果园', '果树坡', '包装棚', '授粉灯', '花粉蛾'] : ['Cloudstep Orchard', 'orchard', 'fruit terraces', 'packing shed', 'pollination lamps', 'moths'],
      facts: [s('采收、分拣和授粉灯巡查都有短工', 'Harvesting, sorting, and pollination-lamp checks all need temporary help'), s('一批花粉蛾改变了往银叶葡萄丘迁飞的方向', 'A flight of pollinating moths has changed course toward Silverleaf Vineyard'), s('包装棚正在寻找一件地址被雨洗掉的包裹', 'The packing shed is looking for a parcel whose address washed away'), s('果园长桌和阁楼客房在收工后开放', 'The orchard table and loft rooms open after the shift')],
    },
  ]
}

export function wanderlightExpansionTravel(locale: Locale): WanderlightTravelDestination[] {
  const zh = locale === 'zh'
  return zh ? [
    { nodeId: 'windglass-cliffs', label: '风玻璃崖', intent: '独自买票去风玻璃崖', arrivalChoices: ['去信号塔询问今夜的风向', '检查崖边新露出的旧路线标记', '去工人厨房问一顿热饭'] },
    { nodeId: 'reedwater-crossing', label: '芦水渡村', intent: '独自买票去芦水渡村', arrivalChoices: ['去水闸边询问渡船什么时候开', '查看卡住的木水闸', '去渡口厨房问公共晚餐'] },
    { nodeId: 'whitecap-baths', label: '白浪浴镇', intent: '独自买票去白浪浴镇', arrivalChoices: ['去公共浴场询问换班工作', '查看洗衣房的失物架', '到蒸汽露台听沿线消息'] },
    { nodeId: 'old-quarry-gardens', label: '旧石坑花园', intent: '独自买票去旧石坑花园', arrivalChoices: ['沿敲石声走进梯田花园', '检查通往蓄雨池的水渠', '询问送往远灯研修院的石件'] },
    { nodeId: 'cloudstep-orchard', label: '云阶果园', intent: '独自买票去云阶果园', arrivalChoices: ['去包装棚询问夜间分拣工作', '检查果树坡上的授粉灯', '查看地址被雨洗掉的包裹'] },
  ] : [
    { nodeId: 'windglass-cliffs', label: 'Windglass Cliffs', intent: 'buy a ticket to Windglass Cliffs', arrivalChoices: ['Ask at the signal tower about tonight’s wind', 'Inspect the old route markers exposed by the cliff', 'Ask for a hot meal in the workers’ kitchen'] },
    { nodeId: 'reedwater-crossing', label: 'Reedwater Crossing', intent: 'buy a ticket to Reedwater Crossing', arrivalChoices: ['Ask by the lock gate when the ferry leaves', 'Inspect the jammed wooden lock gate', 'Ask about the public supper at the ferry kitchen'] },
    { nodeId: 'whitecap-baths', label: 'Whitecap Baths', intent: 'buy a ticket to Whitecap Baths', arrivalChoices: ['Ask about a shift at the public baths', 'Check the laundry’s lost-property shelves', 'Listen for route news on the steam terrace'] },
    { nodeId: 'old-quarry-gardens', label: 'Old Quarry Gardens', intent: 'buy a ticket to Old Quarry Gardens', arrivalChoices: ['Follow the sound of stonework into the terraces', 'Inspect the channel leading to the rain pool', 'Ask about the stone pieces bound for Far Lantern'] },
    { nodeId: 'cloudstep-orchard', label: 'Cloudstep Orchard', intent: 'buy a ticket to Cloudstep Orchard', arrivalChoices: ['Ask about night sorting work at the packing shed', 'Inspect the pollination lamps on the fruit terraces', 'Look at the parcel whose address washed away'] },
  ]
}

function debutTurns(locale: Locale): Array<{ action: string; location: string; characterId: string; turn: DemoTurn; reunion: DemoTurn }> {
  const zh = locale === 'zh'
  return zh ? [
    {
      action: '去信号塔询问今夜的风向', location: '风玻璃崖', characterId: 'iona-calder',
      turn: { match: ['信号塔', '今夜的风向'], content: `信号塔外，一个三十五岁左右的女人正把被风扯松的布筒重新扣上铜环。她剃短了头发，只在左鬓留着一缕银灰细辫，青绿色信号外套上别着黄铜风标。

塔门旁的值夜板写着“伊奥娜·考德”。她用指节敲了敲盐镜上新出现的裂纹，又把一张泡皱的海岸图压在石台上。

[伊奥娜·考德] [main] [专注]: "今晚的风会把雾推向月线。你要是愿意，可以帮我对照崖下的旧标记；我会先说明路线和报酬。"
[character_update: character_id="iona-calder" character="伊奥娜·考德" role="35 岁 · 风崖天气观测员" detail="在风玻璃崖核对盐镜、风向和旧海岸标记" vitality="71" stress="29"]
[choices: "帮伊奥娜对照崖下的旧路线标记"|"问她这张图为什么少了一段海岸"|"只记下天气，先去工人厨房"]`, imagePrompt: 'Windglass Cliffs signal tower at dusk, Iona Calder fastening one windsock beside a cracked salt mirror and blank coastal map, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'iona-calder' },
      reunion: { match: [], content: `伊奥娜从盐镜后抬头，左鬓的银灰细辫和外套上的黄铜风标让你立刻认出她。她已经把今晚的风向分成三段，并在旧海岸图上留出一处没有擅自补写的空白。

[伊奥娜·考德] [main] [平静]: "你来得正好。要继续查旧标记，还是先听我说月线今晚会停哪几站？"
[choices: "和伊奥娜继续核对旧路线标记"|"询问月线今晚的临时停站"|"告诉她这次只想避风休息"]` },
    },
    {
      action: '去水闸边询问渡船什么时候开', location: '芦水渡村', characterId: 'luc-maren',
      turn: { match: ['水闸', '渡船什么时候开'], content: `木水闸旁，一个三十三岁的男人正半跪着把卡住的链轮从芦苇里清出来。他黑色卷发剪到衣领上方，右眉横着一道浅疤，锈红工作背心上挂着绿色珐琅扳手牌。

闸屋工具板上写着“卢克·马伦——当班修理”。他把扳手递给旁边的学徒，先指了指正在上升的水线。

[卢克·马伦] [main] [直接]: "闸门不复位，渡船就不开。你可以等，也可以帮我清另一侧的绳槽；开工前我会把报酬说清楚。"
[character_update: character_id="luc-maren" character="卢克·马伦" role="33 岁 · 渡船与水闸修理师" detail="在芦水渡村处理卡住的木水闸" vitality="86" stress="34"]
[choices: "帮卢克清理水闸另一侧的绳槽"|"问他停运后去潮汐群岛的水路"|"等渡船恢复，不接这份工作"]`, imagePrompt: 'Reedwater Crossing wooden lock gate, Luc Maren clearing reeds from one exposed chain wheel beside a small ferry, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'luc-maren' },
      reunion: { match: [], content: `卢克从渡船底下滑出来，右眉的浅疤和绿色扳手牌仍沾着水。他认出你后先检查水线，没有假装这趟船已经安全。

[卢克·马伦] [main] [务实]: "东侧闸门好了，西侧还要半小时。你要帮忙、等船，还是先去厨房，都可以现在决定。"
[choices: "帮卢克检查西侧闸门"|"等下一班渡船"|"去渡口厨房吃点东西"]` },
    },
    {
      action: '去公共浴场询问换班工作', location: '白浪浴镇', characterId: 'noor-bell',
      turn: { match: ['公共浴场', '换班工作'], content: `公共浴场门口，一个三十二岁左右的人正把湿毛巾分进三只藤篮。深色卷发包在高高的布巾里，右颊边落着一绺卷发，梅紫围裙上别着蓝绿色陶瓷汤勺。

换班夹板的当值栏写着“诺尔·贝尔”。诺尔把最后一篮推到干燥线下，才转身问你能做多久。

[诺尔·贝尔] [main] [温和]: "洗衣房缺一小时的人，厨房缺半小时的人。两边报酬不同，我不会把热饭说成免费。"
[character_update: character_id="noor-bell" character="诺尔·贝尔" role="32 岁 · 公共浴场管事与流动厨师" detail="在白浪浴镇安排洗衣、热水与公共厨房换班" vitality="78" stress="23"]
[choices: "问诺尔洗衣房和厨房各付多少"|"帮诺尔把藤篮送去干燥线"|"先查看失物架上的夜市物件"]`, imagePrompt: 'Whitecap Baths laundry court filled with steam, Noor Bell sorting wet towels into three wicker baskets beneath drying lines, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'noor-bell' },
      reunion: { match: [], content: `诺尔从公共厨房端出一只空汤锅，布巾和梅紫围裙让你在人群里认出他们。诺尔没有默认你会留下，只把今天还缺人的班次和热饭时间分别说清楚。

[诺尔·贝尔] [main] [轻松]: "你可以接班，也可以只坐到蒸汽散掉。先说清楚，比事后算账省力。"
[choices: "问诺尔今天还缺哪一班"|"一起整理失物架"|"到蒸汽露台休息"]` },
    },
    {
      action: '沿敲石声走进梯田花园', location: '旧石坑花园', characterId: 'eden-shaw',
      turn: { match: ['敲石声', '梯田花园'], content: `敲击声来自第二层石台。一个四十一岁的男人正用小锤修平断裂的水渠边缘，铁灰长发低低束在颈后，浅色手套沾着青苔，胸前挂着方形铜尺坠。

工具箱内侧签着“伊登·肖”。他先把松动的石片移到安全处，才让你靠近那段月光下微微发暖的石层。

[伊登·肖] [main] [谨慎]: "这块石头留在这里。要挣钱，可以帮我清水渠；要研究，也先说你打算把结果交给谁。"
[character_update: character_id="eden-shaw" character="伊登·肖" role="41 岁 · 石坑园艺师与石工" detail="在旧石坑花园修复梯田水渠并保护月暖石层" vitality="83" stress="20"]
[choices: "帮伊登清理通往蓄雨池的水渠"|"问远灯研修院在等哪些旧石件"|"承诺不取样，只观察月暖石层"]`, imagePrompt: 'Old Quarry Gardens terraced stone channel at moonrise, Eden Shaw repairing one cracked edge beside moss and rain pools, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'eden-shaw' },
      reunion: { match: [], content: `伊登从梯田下层抬起头，低束的铁灰长发和方形铜尺坠让你认出他。他已经把水流引回蓄雨池，却仍把那段月暖石留在原处。

[伊登·肖] [main] [安静]: "上次说过的边界还算数。今天你想修水渠、送石件，还是只走一圈花园？"
[choices: "和伊登继续修水渠"|"帮忙核对送往远灯的石件"|"沿梯田花园走一圈"]` },
    },
    {
      action: '去包装棚询问夜间分拣工作', location: '云阶果园', characterId: 'nessa-rill',
      turn: { match: ['包装棚', '夜间分拣工作'], content: `包装棚门口，一个二十七岁的女人正用肩膀顶住滑落的邮袋，同时把一只湿包裹从果箱下面抽出来。她黑色齐短发的左眉上方有一道白色发束，芥末黄短雨披下斜背着三枚铜扣的深蓝邮袋。

雨披内侧的路线牌写着“妮莎·里尔”。她没有拆开地址被雨洗掉的包裹，只对照封绳和果园出货簿。

[妮莎·里尔] [main] [克制]: "我送东西，不替收件人猜内容。你要接分拣工作可以；要帮我找地址，就从看得见的线索开始。"
[character_update: character_id="nessa-rill" character="妮莎·里尔" role="27 岁 · 沿线邮递员" detail="在云阶果园保护一件地址被雨洗掉的包裹" vitality="76" stress="36"]
[choices: "帮妮莎核对包裹封绳和出货簿"|"先问包装棚今晚的分拣报酬"|"去果树坡检查授粉灯"]`, imagePrompt: 'Cloudstep Orchard packing shed at night, Nessa Rill steadying one navy mailbag while recovering one rain-wet parcel from fruit crates, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'nessa-rill' },
      reunion: { match: [], content: `妮莎把深蓝邮袋放上包装台，三枚铜扣和左眉上方的白色发束没有变。她已经排除两个错误地址，但没有擅自把包裹交出去。

[妮莎·里尔] [main] [清楚]: "现在有三条能核对的路：果园出货簿、沿线失物记录，或者直接等寄件人来问。你选哪条，我就走哪条。"
[choices: "和妮莎核对果园出货簿"|"去查沿线失物记录"|"先不碰包裹，检查授粉灯"]` },
    },
  ] : [
    {
      action: 'Ask at the signal tower about tonight’s wind', location: 'Windglass Cliffs', characterId: 'iona-calder',
      turn: { match: ['signal tower', 'tonight’s wind'], content: `Outside the signal tower, a woman of about thirty-five is fastening a windsock back onto its copper ring. Her head is shaved except for one narrow silver-gray braid at the left temple, and a brass wind-vane pin marks her weathered teal coat.

The duty slate beside the tower door reads “Iona Calder.” She taps a new crack in the salt mirror, then holds a buckled coastal map flat against the stone table.

[Iona Calder] [main] [focused]: "Tonight’s wind will push fog across the Moonline. If you want, help me compare the old markers below the cliff. I’ll state the route and pay first."
[character_update: character_id="iona-calder" character="Iona Calder" role="Age 35 · cliff weather observer" detail="Checking salt mirrors, wind, and old coastal markers at Windglass Cliffs" vitality="71" stress="29"]
[choices: "Help Iona compare the old route markers below the cliff"|"Ask why this map is missing part of the coast"|"Note the weather and go to the workers’ kitchen"]`, imagePrompt: 'Windglass Cliffs signal tower at dusk, Iona Calder fastening one windsock beside a cracked salt mirror and blank coastal map, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'iona-calder' },
      reunion: { match: [], content: `Iona looks up from behind the salt mirror. The silver-gray temple braid and brass wind-vane pin make her immediately familiar. She has divided tonight’s wind into three periods and left one gap on the old coastal map rather than inventing an answer.

[Iona Calder] [main] [quiet]: "Good timing. Do we keep checking the old markers, or do you want tonight’s temporary Moonline stops first?"
[choices: "Continue checking the old route markers with Iona"|"Ask about tonight’s temporary Moonline stops"|"Tell her you only need shelter from the wind"]` },
    },
    {
      action: 'Ask by the lock gate when the ferry leaves', location: 'Reedwater Crossing', characterId: 'luc-maren',
      turn: { match: ['lock gate', 'ferry leaves'], content: `Beside the wooden lock gate, a man of thirty-three kneels to clear reeds from a jammed chain wheel. His wavy black hair ends above the collar, a pale scar crosses his right eyebrow, and a green enamel wrench tag hangs from his rust-red work vest.

The lock-house tool board reads “Luc Maren — mechanic on duty.” He passes the wrench to an apprentice and points first to the rising waterline.

[Luc Maren] [main] [direct]: "The ferry stays put until the gate resets. You can wait, or help me clear the other rope channel. I’ll state the pay before we start."
[character_update: character_id="luc-maren" character="Luc Maren" role="Age 33 · ferry and lock mechanic" detail="Clearing a jammed wooden lock gate at Reedwater Crossing" vitality="86" stress="34"]
[choices: "Help Luc clear the other rope channel"|"Ask about the after-hours water route to the Tidal Islands"|"Wait for the ferry without taking the job"]`, imagePrompt: 'Reedwater Crossing wooden lock gate, Luc Maren clearing reeds from one exposed chain wheel beside a small ferry, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'luc-maren' },
      reunion: { match: [], content: `Luc slides out from beneath the ferry, the scar through his right brow and green wrench tag still wet. He recognizes you, then checks the waterline before pretending the crossing is safe.

[Luc Maren] [main] [practical]: "The east gate is fixed. The west needs half an hour. Help, wait for the boat, or use the kitchen—you can choose now."
[choices: "Help Luc inspect the west gate"|"Wait for the next ferry"|"Get something to eat at the ferry kitchen"]` },
    },
    {
      action: 'Ask about a shift at the public baths', location: 'Whitecap Baths', characterId: 'noor-bell',
      turn: { match: ['public baths', 'shift'], content: `At the public bath entrance, a person of about thirty-two sorts wet towels into three wicker baskets. Thick dark curls are gathered in a high cloth wrap, with one curl loose at the right cheek, and a turquoise ceramic ladle pin sits on a plum apron.

The duty column on the shift board reads “Noor Bell.” Noor pushes the final basket beneath the drying line before asking how long you can work.

[Noor Bell] [main] [warm]: "The laundry needs an hour. The kitchen needs half of one. They pay differently, and I won’t call the hot meal free."
[character_update: character_id="noor-bell" character="Noor Bell" role="Age 32 · public bath steward and traveling cook" detail="Coordinating laundry, hot water, and kitchen shifts at Whitecap Baths" vitality="78" stress="23"]
[choices: "Ask what the laundry and kitchen shifts each pay"|"Help Noor carry the baskets to the drying line"|"Check the market items on the lost-property shelf"]`, imagePrompt: 'Whitecap Baths laundry court filled with steam, Noor Bell sorting wet towels into three wicker baskets beneath drying lines, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'noor-bell' },
      reunion: { match: [], content: `Noor carries an empty stockpot out of the public kitchen. The cloth wrap and plum apron make them easy to recognize in the steam. Noor does not assume you will stay, and lists today’s open shifts separately from the meal time.

[Noor Bell] [main] [easy]: "You may take a shift, or sit until the steam clears. Clear terms save work later."
[choices: "Ask Noor which shift still needs help"|"Sort the lost-property shelf together"|"Rest on the steam terrace"]` },
    },
    {
      action: 'Follow the sound of stonework into the terraces', location: 'Old Quarry Gardens', characterId: 'eden-shaw',
      turn: { match: ['stonework', 'terraces'], content: `The tapping comes from the second stone terrace. A man of forty-one uses a small hammer to level the broken edge of a water channel. Iron-gray hair is tied low at his neck, pale gloves carry streaks of moss, and a square copper measuring pendant hangs at his chest.

The inside of the tool case reads “Eden Shaw.” He moves a loose slab to safety before letting you near the seam of stone warming faintly in moonlight.

[Eden Shaw] [main] [careful]: "This stone stays here. If you want coin, help clear the channel. If you want to study it, first tell me who gets the results."
[character_update: character_id="eden-shaw" character="Eden Shaw" role="Age 41 · quarry gardener and stoneworker" detail="Repairing terrace channels and protecting moon-warmed stone at Old Quarry Gardens" vitality="83" stress="20"]
[choices: "Help Eden clear the channel to the rain pool"|"Ask which old stones Far Lantern is waiting for"|"Promise not to take samples and only observe the warm seam"]`, imagePrompt: 'Old Quarry Gardens terraced stone channel at moonrise, Eden Shaw repairing one cracked edge beside moss and rain pools, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'eden-shaw' },
      reunion: { match: [], content: `Eden looks up from the lower terrace. The low-tied iron-gray hair and square copper pendant make him familiar. Water now reaches the rain pool, but the moon-warmed seam remains where it was.

[Eden Shaw] [main] [quiet]: "The boundary we set still holds. Repair the channel, carry stone, or just walk the garden—what do you want today?"
[choices: "Keep repairing the channel with Eden"|"Help check the stone pieces bound for Far Lantern"|"Walk a circuit of the terraced garden"]` },
    },
    {
      action: 'Ask about night sorting work at the packing shed', location: 'Cloudstep Orchard', characterId: 'nessa-rill',
      turn: { match: ['packing shed', 'night sorting work'], content: `At the packing-shed door, a woman of twenty-seven braces a slipping mailbag with one shoulder while drawing a wet parcel out from beneath a fruit crate. Her blunt black hair ends at the chin, one white streak sits above the left brow, and a cropped mustard rain cape covers a navy satchel with three copper buckles.

The route badge inside the cape reads “Nessa Rill.” She does not open the rain-washed parcel, only compares its cord with the orchard dispatch book.

[Nessa Rill] [main] [reserved]: "I deliver things. I don’t interpret them for the recipient. Take the sorting shift if you want; if you help find this address, start with what we can actually see."
[character_update: character_id="nessa-rill" character="Nessa Rill" role="Age 27 · coastal route courier" detail="Protecting a parcel with a rain-washed address at Cloudstep Orchard" vitality="76" stress="36"]
[choices: "Help Nessa compare the parcel cord with the dispatch book"|"Ask what tonight’s sorting shift pays"|"Inspect the pollination lamps on the fruit terraces"]`, imagePrompt: 'Cloudstep Orchard packing shed at night, Nessa Rill steadying one navy mailbag while recovering one rain-wet parcel from fruit crates, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'nessa-rill' },
      reunion: { match: [], content: `Nessa sets the navy satchel on the packing table, its three copper buckles and the white streak above her left brow unchanged. She has ruled out two wrong addresses without handing the parcel to either one.

[Nessa Rill] [main] [clear]: "Three checks remain: the orchard dispatch book, the route lost-property record, or waiting for the sender. Choose one, and that is the one I follow."
[choices: "Check the orchard dispatch book with Nessa"|"Look through the route lost-property record"|"Leave the parcel alone and inspect the pollination lamps"]` },
    },
  ]
}

export function wanderlightExpansionTurns(locale: Locale): { deterministic: DeterministicChoiceTurn[]; demo: DemoTurn[] } {
  const entries = debutTurns(locale)
  const deterministic = entries.flatMap((entry) => [
    { action: entry.action, when: { locations: [entry.location], characterIds: [entry.characterId] }, turn: entry.reunion },
    { action: entry.action, when: { locations: [entry.location] }, turn: entry.turn },
  ])
  return { deterministic, demo: entries.flatMap((entry) => [entry.turn, entry.reunion]) }
}

export function wanderlightExpansionDirector(locale: Locale) {
  const zh = locale === 'zh'
  return {
    fixedRules: zh ? [
      '五名未来预设人物按地区绑定：iona-calder 伊奥娜在风玻璃崖；luc-maren 卢克在芦水渡村；noor-bell 诺尔在白浪浴镇；eden-shaw 伊登在旧石坑花园；nessa-rill 妮莎主要沿云阶果园邮路活动。玩家抵达并完成可见登场前，他们仍是隐藏人物。',
      '长期世界线索跨地点留下后果：旧海岸地图连接远灯研修院与风玻璃崖；授粉迁飞连接银叶葡萄丘与云阶果园；沿线演出连接杯影夜市、潮汐群岛和白浪浴镇；水闸影响芦水渡村与群岛；邮袋只连接玩家已经见过的人和地点。',
    ] : [
      'Five future authored people are region-bound: iona-calder Iona at Windglass Cliffs; luc-maren Luc at Reedwater Crossing; noor-bell Noor at Whitecap Baths; eden-shaw Eden at Old Quarry Gardens; nessa-rill Nessa mainly along the Cloudstep Orchard mail route. They remain hidden until the player arrives and a visible debut is completed.',
      'Long-running world threads leave consequences across places: the old coastal map links Far Lantern with Windglass; pollinator migration links Silverleaf with Cloudstep; route performances link Cupshadow, the Tidal Islands, and Whitecap; the lock gate links Reedwater with the islands; the courier bag may connect only people and places the player already knows.',
    ],
    generationRules: zh ? [
      '优先延续当前未完成的具体行动；没有未完事项时，从当前地点尚未使用的工作、日常社交、环境变化或人物来访事件族中选择，不连续重复同一种通用活动。',
      '新地区第一次出现时，先用可感知的地标和当地正在做的事建立区别，再引出人物；不要把五个新地点都写成同一套短工告示。',
      '跨区域线索每次只推进一个可核对的新事实；邮递、地图和传闻不能凭空泄露玩家尚未认识的人。',
    ] : [
      'Continue the current unfinished concrete action first. When none exists, choose an unused work, daily social, environmental change, or visitor event family from the current place; do not repeat the same generic activity back to back.',
      'On a region’s first appearance, establish its distinct visible landmark and current local activity before introducing a person. Do not reduce all five new places to the same shift board.',
      'Advance a cross-region thread by one checkable fact at a time. Mail, maps, and rumors cannot reveal people the player has not met.',
    ],
    threats: zh ? [
      '风玻璃崖的信号灯被盐雾遮住', '芦水渡村的水闸在涨潮前卡死', '白浪浴镇的热水管突然停流', '旧石坑花园的蓄雨渠越过安全水位', '云阶果园的授粉灯引错了蛾群', '沿线邮袋里出现两件地址相同的包裹',
    ] : [
      'salt fog hides the Windglass signal lamp', 'the Reedwater lock gate jams before high tide', 'hot water stops flowing at Whitecap Baths', 'the Old Quarry rain channel rises above its safe mark', 'Cloudstep’s pollination lamps draw the moths off course', 'two parcels in the route bag carry the same address',
    ],
  }
}
