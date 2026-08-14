import type { CharacterDefinition, CharacterVisualIdentity, Locale, StoryCartridge } from '../types'
import { wanderlightV1Content } from './wanderlightV1Content'
import { wanderlightV1Outcomes } from './wanderlightV1Outcomes'

const coverImage = new URL('../img/worlds/wanderlight-entry.png', import.meta.url).href
const entryImage = new URL('../img/worlds/wanderlight-entry.png', import.meta.url).href

const GOUACHE = 'EDITORIAL GOUACHE PAINTING, opaque matte brush shapes, visible dry-brush edges, simplified but observant adult features, deep indigo, mineral teal, sage and warm copper palette, sophisticated contemporary travel illustration, no glossy 3D, no photorealism'

const identity = (appearance: string, traits: string[], wardrobe: string[], forbidden: string[], anchorTaskId?: string): CharacterVisualIdentity => ({
  status: anchorTaskId ? 'anchored' : 'queued', version: 1, source: 'authored', appearance, anchorTaskId,
  immutableTraits: traits, wardrobe, forbiddenDrift: forbidden,
})

function cast(locale: Locale): CharacterDefinition[] {
  const zh = locale === 'zh'
  return [
    {
      id: 'mira-voss', name: zh ? '媛夕' : 'Mira Voss', role: zh ? '28 岁 · 地方植物研究员' : 'Age 28 · field botanist', vitality: 82, stress: 24, hiddenUntilIntroduced: true,
      skills: [{ id: 'fieldcraft', label: zh ? '野外辨识' : 'Fieldcraft', value: 4 }, { id: 'candor', label: zh ? '坦率' : 'Candor', value: 2 }],
      detail: zh ? '研究会对月光改变方向的植物，习惯先做事再解释。' : 'Studies plants that turn toward moonlight and acts before she explains.',
      lore: zh ? '她拒绝了首都研究所的长期职位。' : 'She declined a permanent capital institute post.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult woman age 28, lean field-researcher build, warm olive skin, short asymmetrical deep-brown bob tucked behind the right ear, one narrow copper hairpin above the right ear, calm direct dark eyes, sage work jacket with rolled cuffs, copper seed-pod pendant, natural adult anatomy, no text.`,
        ['age 28 adult presentation', 'short asymmetrical deep-brown bob', 'narrow copper hairpin above right ear', 'warm olive skin', 'copper seed-pod pendant'],
        ['sage field jacket', 'charcoal work layers', 'weathered copper accents'],
        ['younger or teen appearance', 'long or pale hair', 'missing copper hairpin', 'facial scar', 'formal gown', 'anime proportions'],
        'mt_20934e2b8d43fa75beb9c9202d00ac8a',
      ),
    },
    {
      id: 'rowan-hale', name: zh ? '罗温' : 'Rowan Hale', role: zh ? '31 岁 · 月线乘务与地图修复师' : 'Age 31 · Moonline steward and map restorer', vitality: 74, stress: 31, hiddenUntilIntroduced: true,
      skills: [{ id: 'routes', label: zh ? '路线记忆' : 'Route memory', value: 5 }, { id: 'poise', label: zh ? '从容' : 'Poise', value: 3 }],
      detail: zh ? '负责月线晚班，也替乘客修补被雨泡坏的地图。' : 'Works late Moonline shifts and repairs rain-damaged maps.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult man age 31, slender tall build, medium brown skin, close-curled black hair, narrow brushed-metal glasses, composed observant expression, indigo railway coat, pale shirt, small silver ticket clip on the left lapel, natural adult anatomy, no text.`,
        ['age 31 adult presentation', 'close-curled black hair', 'narrow metal glasses', 'medium brown skin', 'silver ticket clip'],
        ['indigo railway coat', 'pale collar', 'matte silver hardware'],
        ['teen appearance', 'straight pale hair', 'no glasses', 'military uniform', 'bodybuilder proportions'],
        'mt_bdd2cf96f4732e62cde9baade1b05353',
      ),
    },
    {
      id: 'celeste-ardin', name: zh ? '塞莱斯特' : 'Celeste Ardin', role: zh ? '26 岁 · 夜市乐师与临时雇主' : 'Age 26 · night-market musician and occasional employer', vitality: 77, stress: 38, hiddenUntilIntroduced: true,
      skills: [{ id: 'performance', label: zh ? '演出' : 'Performance', value: 5 }, { id: 'reading-room', label: zh ? '察言观色' : 'Reading the room', value: 4 }],
      detail: zh ? '在杯影夜市组织演出，也会雇人搬运和布台。' : 'Organizes Cupshadow Market shows and hires help with hauling and staging.',
      visualIdentity: identity(
        `${GOUACHE}. One grounded adult woman age 26, strong graceful build, copper-brown skin, long auburn hair in a loose side braid over the left shoulder, one brass ear cuff on the right ear, expressive dark eyes, terracotta shawl over black performance clothes, natural adult anatomy, no text.`,
        ['age 26 adult presentation', 'long auburn side braid over left shoulder', 'single brass ear cuff on right ear', 'copper-brown skin', 'terracotta shawl'],
        ['terracotta shawl', 'black performance layers', 'aged brass details'],
        ['teen appearance', 'short black hair', 'missing right-ear cuff', 'duplicated instrument cases', 'school uniform', 'exaggerated anatomy'],
        'mt_8e6688de6ebff48488581f38aca6541b',
      ),
    },
  ]
}

function domainRules(locale: Locale): NonNullable<StoryCartridge['domainRules']> {
  const zh = locale === 'zh'
  const s = (cn: string, en: string) => zh ? cn : en
  const localChoices = [
    s('看看这里还有什么工作', 'Look for another local job'),
    s('找个人聊聊最近的消息', 'Ask someone for local news'),
    s('前往月线车站', 'Head to the Moonline station'),
  ] as [string, string, string]
  return {
    rules: [
      {
        id: 'catch-breath', intent: s('原地休息四十五分钟', 'rest in place for forty-five minutes'),
        match: [s('原地坐下，休息四十五分钟', 'sit down and rest for forty-five minutes'), s('再休息四十五分钟', 'rest for another forty-five minutes'), s('原地休息', 'rest in place'), s('慢慢恢复呼吸', 'catch my breath')],
        requirements: [],
        effects: [{ type: 'stat', id: 'energy', delta: 8 }, { type: 'clock-add', minutes: 45 }, { type: 'fact-add', id: 'exhaustion_recoveries', delta: 1 }],
        successText: s('你不再勉强往前走，而是原地坐下，等呼吸和双腿慢慢恢复。四十五分钟后，你重新有了行动的力气。', 'You stop forcing yourself onward and sit until your breathing and legs steady. Forty-five minutes later, you can move again.'),
        successChoices: [s('再休息四十五分钟', 'Rest for another forty-five minutes'), s('花四枚钱币吃一顿热饭', 'Spend four coin on a hot meal'), s('结束今天，休息到清晨', 'End the day and rest until morning')],
        rejectionChoices: [s('原地坐下，休息四十五分钟', 'Sit down and rest for forty-five minutes'), s('放弃当前行动，去最近的公共休息处', 'Abandon the current action and reach the nearest public rest area'), s('结束今天，休息到清晨', 'End the day and rest until morning')],
      },
      {
        id: 'retreat-to-rest', intent: s('前往最近的公共休息处', 'reach the nearest public rest area'),
        match: [s('放弃当前行动，去最近的公共休息处', 'abandon the current action and reach the nearest public rest area'), s('去最近的公共休息处', 'reach the nearest public rest area'), s('找公共休息处', 'find a public rest area')],
        requirements: [],
        effects: [{ type: 'stat', id: 'energy', delta: 16 }, { type: 'clock-add', minutes: 120 }, { type: 'fact-add', id: 'exhaustion_recoveries', delta: 1 }],
        successText: s('你放弃原来的安排，沿途停了几次，终于到达最近的公共休息处。两小时过去，错过的行程不会倒转，但你已经能够继续行动。', 'You abandon the original plan and stop several times before reaching the nearest public rest area. Two hours pass; the missed plan will not rewind, but you can move again.'),
        successChoices: [s('查看现在还能做什么', 'See what is still possible now'), s('花四枚钱币吃一顿热饭', 'Spend four coin on a hot meal'), s('结束今天，休息到清晨', 'End the day and rest until morning')],
        rejectionChoices: [s('原地坐下，休息四十五分钟', 'Sit down and rest for forty-five minutes'), s('放弃当前行动，去最近的公共休息处', 'Abandon the current action and reach the nearest public rest area'), s('结束今天，休息到清晨', 'End the day and rest until morning')],
      },
      {
        id: 'rest-until-morning', intent: s('结束今天并休息到清晨', 'end the day and rest until morning'),
        match: [s('结束今天，休息到清晨', 'end the day and rest until morning'), s('休息到清晨', 'rest until morning'), s('今天不再行动', 'stop for the day')],
        requirements: [],
        effects: [{ type: 'stat', id: 'energy', delta: 36 }, { type: 'clock-add', minutes: 600 }, { type: 'fact-add', id: 'exhaustion_recoveries', delta: 1 }, { type: 'session', ended: true, reason: s('你结束了今天的行动。地点、人物和约定都已保存；下次回来时，从休息后的清晨继续。', 'You end the day. Places, people, and promises are saved; the next visit begins after your morning rest.') }],
        successText: s('你不再追赶今晚剩下的安排，找到能避风的地方休息。睡意很快盖过远处的声响。', 'You stop chasing the rest of tonight’s plans and find shelter from the wind. Sleep soon covers the distant sounds.'),
        successChoices: [s('清晨查看新的工作', 'Check the morning job board'), s('清晨去月线车站', 'Go to the Moonline station in the morning'), s('清晨拜访认识的人', 'Visit someone you know in the morning')],
        rejectionChoices: [s('原地坐下，休息四十五分钟', 'Sit down and rest for forty-five minutes'), s('放弃当前行动，去最近的公共休息处', 'Abandon the current action and reach the nearest public rest area'), s('结束今天，休息到清晨', 'End the day and rest until morning')],
      },
      {
        id: 'local-shift', intent: s('完成一份当地短工', 'complete a local shift'),
        match: [s('找一份短工', 'look for a short job'), s('做短工', 'take a local shift'), s('继续干活', 'keep working'), s('帮忙干活', 'help with the work'), s('完成这份工作', 'finish the job'), s('干完这份活', 'complete the shift'), s('结清工钱', 'collect my pay'), s('领取报酬', 'receive the payment')],
        requirements: [{ type: 'stat', id: 'energy', min: 12, reason: s('你太累了，手上的活已经开始出错。先吃点东西或休息。', 'You are too tired to work safely. Eat or rest first.') }],
        effects: [{ type: 'stat', id: 'energy', delta: -10 }, { type: 'stat', id: 'coin', delta: 9 }, { type: 'stat', id: 'renown', delta: 2 }, { type: 'clock-add', minutes: 90 }, { type: 'fact-add', id: 'jobs_completed', delta: 1 }],
        successText: s('你接下一份九十分钟的短工。活不轻松，但工钱当场结清；附近的人也开始认得你。', 'You take a ninety-minute local shift. The work is tiring, but you are paid on the spot, and a few people now recognize you.'),
        successChoices: localChoices,
        rejectionChoices: [s('花四枚钱币吃一顿热饭', 'Spend four coin on a hot meal'), s('找个安静角落休息', 'Rest somewhere quiet'), s('问熟人能不能帮忙', 'Ask someone you know for help')],
      },
      {
        id: 'hot-meal', intent: s('吃一顿热饭', 'eat a hot meal'),
        match: [s('吃一顿热饭', 'eat a hot meal'), s('吃点东西', 'get something to eat'), s('买一顿饭', 'buy a meal')],
        requirements: [{ type: 'stat', id: 'coin', min: 4, reason: s('你还差几枚钱币，摊主没有答应赊账。', 'You are a few coin short, and the vendor will not open a tab.') }],
        effects: [{ type: 'stat', id: 'coin', delta: -4 }, { type: 'stat', id: 'energy', delta: 12 }, { type: 'clock-add', minutes: 35 }, { type: 'fact-add', id: 'meals_eaten', delta: 1 }],
        successText: s('你吃完一碗冒着热气的炖菜，坐到双手不再发冷才起身。', 'You finish a bowl of hot stew and stay seated until your hands stop feeling cold.'),
        successChoices: localChoices,
        rejectionChoices: [s('找一份能立刻结钱的短工', 'Find a job that pays immediately'), s('向认识的人说明情况', 'Explain the situation to someone you know'), s('不花钱休息一会儿', 'Rest for a while without spending')],
      },
      {
        id: 'overnight-room', intent: s('住一晚并保存', 'stay overnight and save'),
        match: [s('住一晚', 'stay for the night'), s('租个房间', 'rent a room'), s('在旅店休息', 'rest at the inn')],
        requirements: [{ type: 'stat', id: 'coin', min: 10, reason: s('房费是十枚钱币，你现在付不起。', 'The room costs ten coin, which you cannot afford yet.') }],
        effects: [{ type: 'stat', id: 'coin', delta: -10 }, { type: 'stat', id: 'energy', delta: 28 }, { type: 'clock-add', minutes: 660 }, { type: 'fact-add', id: 'nights_slept', delta: 1 }, { type: 'session', ended: true, reason: s('你关上房门。今晚的地点、人物和约定都已保存；下次回来时，从清晨继续。', 'You close the door. Tonight’s places, people, and promises are saved; the next visit begins in the morning.') }],
        successText: s('热水、干床单和一扇能锁上的门，让这一天终于停了下来。', 'Hot water, dry sheets, and a door that locks finally bring the day to a stop.'),
        successChoices: [s('清晨查看新的工作', 'Check the morning job board'), s('清晨去月线车站', 'Go to the Moonline station in the morning'), s('清晨拜访认识的人', 'Visit someone you know in the morning')],
        rejectionChoices: [s('再找一份短工', 'Take another short job'), s('只买一顿热饭', 'Buy only a hot meal'), s('在公共休息处过夜', 'Use the public rest area')],
      },
      {
        id: 'carriage-rest', intent: s('在月线车厢休息', 'rest in the Moonline carriage'),
        match: [s('在车厢休息', 'rest in the carriage'), s('在车上眯一会', 'nap on the train'), s('靠着车窗休息', 'rest by the window')],
        requirements: [{ type: 'map', nodeId: 'moonline-carriage', reason: s('你得先上月线，才能在车厢里休息。', 'You need to board the Moonline before you can rest in its carriage.') }],
        effects: [{ type: 'stat', id: 'energy', delta: 8 }, { type: 'clock-add', minutes: 45 }, { type: 'fact-add', id: 'carriage_rests', delta: 1 }],
        successText: s('你靠着温热的车窗闭了一会儿眼。列车没有停，但肩膀终于放松下来。', 'You close your eyes against the warm window. The train keeps moving, but the tension leaves your shoulders.'),
        successChoices: [s('在下一站下车', 'Get off at the next stop'), s('问乘务员下一站有什么', 'Ask the steward about the next stop'), s('继续留在车厢', 'Stay in the carriage')],
        rejectionChoices: [s('前往月线车站', 'Head to the Moonline station'), s('在原地找地方休息', 'Find somewhere to rest here'), s('继续眼前的事', 'Continue what you were doing')],
      },
      ...[
        ['silverleaf-vineyard', s('银叶葡萄丘', 'Silverleaf Vineyard'), s('独自买票去银叶葡萄丘', 'buy a ticket to Silverleaf Vineyard')],
        ['cupshadow-market', s('杯影夜市', 'Cupshadow Market'), s('独自买票去杯影夜市', 'buy a ticket to Cupshadow Market')],
        ['mistpine-forest', s('雾杉林', 'Mistpine Forest'), s('独自买票去雾杉林', 'buy a ticket to Mistpine Forest')],
        ['tidal-islands', s('潮汐群岛', 'Tidal Islands'), s('独自买票去潮汐群岛', 'buy a ticket to the Tidal Islands')],
        ['far-lantern-institute', s('远灯研修院', 'Far Lantern Institute'), s('独自买票去远灯研修院', 'buy a ticket to Far Lantern Institute')],
        ['lantern-quay', s('灯湾码头', 'Lantern Quay'), s('独自买票回灯湾码头', 'buy a ticket back to Lantern Quay')],
      ].map(([nodeId, label, intent]) => ({
        id: `travel-${nodeId}`,
        intent,
        match: [intent, s(`独自前往${label}`, `travel alone to ${label}`), s(`买票前往${label}`, `buy passage to ${label}`)],
        requirements: [
          { type: 'map' as const, notNodeId: nodeId, reason: s(`你已经在${label}。`, `You are already at ${label}.`) },
          { type: 'stat' as const, id: 'coin', min: 3, reason: s('普通车票需要三枚钱币。你可以先接短工，或找乘务员谈谈。', 'A regular ticket costs three coin. Take a short job or speak with the steward first.') },
          { type: 'stat' as const, id: 'energy', min: 2, reason: s('你连走到月台都很勉强。先休息一下。', 'You are too tired even to reach the platform. Rest first.') },
        ],
        effects: [{ type: 'stat' as const, id: 'coin', delta: -3 }, { type: 'stat' as const, id: 'energy', delta: -2 }, { type: 'clock-add' as const, minutes: 55 }, { type: 'map' as const, nodeId }],
        successText: s(`你买好车票，先回到月台。列车关门后，旧地点的灯从湿玻璃上退远；再次开门时，${label}已经在外面。`, `You buy a ticket and return to the platform. The old lights recede across the wet glass; when the doors open again, ${label} is outside.`),
        successChoices: [s(`看看${label}的工作`, `Look for work in ${label}`), s(`找个人问问${label}的近况`, `Ask someone what is happening in ${label}`), s('先找地方休息', 'Find somewhere to rest first')] as [string, string, string],
        rejectionChoices: [s('找一份短工', 'Look for a short job'), s('找地方休息', 'Find somewhere to rest'), s('继续探索当前地点', 'Keep exploring the current place')] as [string, string, string],
      })),
    ],
  }
}

function worldMap(locale: Locale): StoryCartridge['initialMap'] {
  const zh = locale === 'zh'
  const s = (cn: string, en: string) => zh ? cn : en
  return [
    {
      id: 'lantern-quay', label: s('灯湾码头', 'Lantern Quay'), current: true, visited: true,
      detail: s('渡口、月线总站和临时招工点都在这片湿石广场上。', 'The ferry, Moonline terminal, and day-labor posts share this wet-stone square.'),
      facts: [s('末班月线 19:20 离站', 'Last Moonline leaves at 19:20'), s('可做路线整理和码头搬运', 'Route sorting and dock hauling pay on completion'), s('渡口食堂和楼上旅店整夜营业', 'The ferry canteen and upstairs inn stay open all night')],
    },
    {
      id: 'moonline-carriage', label: s('月线车厢', 'Moonline Carriage'), connectedTo: s('灯湾码头', 'Lantern Quay'),
      detail: s('开往海岸各地的夜班车厢，适合在途中休息和保存进度。', 'A night carriage serving the coast, with time to rest and save along the way.'),
      facts: [s('靠窗休息可恢复精力但会推进时间', 'Window-seat rest restores energy while time advances'), s('乘务员会说明下一站的工作与住宿', 'Stewards can explain work and lodging at the next stop')],
    },
    {
      id: 'cupshadow-market', label: s('杯影夜市', 'Cupshadow Market'), connectedTo: s('灯湾码头', 'Lantern Quay'),
      detail: s('雨棚下有演出、食摊、搬运和布台短工。', 'Awnings shelter performances, food stalls, hauling, and stage work.'),
      facts: [s('搬运和布台按场结算', 'Hauling and stage setup pay after each show'), s('共餐长桌是认识摊主和乐师的地方', 'A shared supper table brings vendors and musicians together'), s('闭市后可回灯湾旅店休息', 'The Lantern Quay inn remains available after closing')],
    },
    {
      id: 'silverleaf-vineyard', label: s('银叶葡萄丘', 'Silverleaf Vineyard'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      detail: s('葡萄藤随月光转向，田舍常雇季节短工。', 'Moon-turning vines and field houses that hire seasonal workers.'),
      facts: [s('藤架修补和田野记录需要短工', 'Trellis repair and field surveys need temporary help'), s('晚餐长桌与试饮不要求发展亲密关系', 'Supper and tasting invitations carry no romantic obligation'), s('田舍有十枚钱币的客房', 'The field house rents rooms for ten coin')],
    },
    {
      id: 'mistpine-forest', label: s('雾杉林', 'Mistpine Forest'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      detail: s('有安全栈道、菌类调查和林灯维护工作。', 'Safe boardwalks, mushroom surveys, and forest-lamp maintenance.'),
      facts: [s('菌类调查和林灯维护按路线结算', 'Mushroom surveys and lamp maintenance pay by route'), s('护林人共用的茶棚适合交换消息', 'A ranger tea shelter is used for news and company'), s('夜间只能在灯屋或月线站休息', 'Night rest is limited to lamp houses or the Moonline stop')],
    },
    {
      id: 'tidal-islands', label: s('潮汐群岛', 'Tidal Islands'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      detail: s('退潮时木桥连起渔业、修网和乐器工坊。', 'At low tide, bridges link fishing, net-mending, and instrument workshops.'),
      facts: [s('修网和码头搬运在涨潮前结算', 'Net mending and landing work pay before high tide'), s('清晨演出和公共灶台是主要社交场所', 'Dawn performances and the public stove are social gathering places'), s('涨潮后可住桥头客舍或搭月线离开', 'After high tide, use the bridgehead guesthouse or leave by Moonline')],
    },
    {
      id: 'far-lantern-institute', label: s('远灯研修院', 'Far Lantern Institute'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      detail: s('只招收成年人的职业与实用魔法研修院。', 'An adult institute for trades and practical magic.'),
      facts: [s('夜间工坊会发布修理与记录工作', 'Night workshops post repair and recording jobs'), s('开放讲座和公共工作台允许访客参加', 'Open lectures and shared benches welcome adult visitors'), s('空余客房每晚十枚钱币', 'Available guest rooms cost ten coin per night')],
    },
  ]
}

function make(locale: Locale): StoryCartridge {
  const zh = locale === 'zh'
  const s = (cn: string, en: string) => zh ? cn : en
  const miraDebut = zh
    ? `你一脚踩住最后一只滚向铁轨的种荚。它只有核桃大小，薄壳里透着淡光。短发女人用膝盖抵住木箱，把其余种荚扫回帆布。她右耳上方别着一枚窄铜发夹，胸前挂着同样形状的种荚坠饰。\n\n木箱的货签上写着“媛夕，二十八岁，银叶田野调查”。她扣好箱盖，先看了一眼铁轨，才抬头看你。\n\n[媛夕] [main] [松了一口气]: "这些种子会跟着月光转，刚才差点全滚进车轮底下。再帮我把箱子送上车，我付你八枚钱币。"\n[character_update: character_id="mira-voss" character="媛夕" role="28 岁 · 地方植物研究员" detail="在灯湾月台收拢险些落轨的发光种荚" vitality="82" stress="24"]\n[job: action="offer" id="mira-seed-crate" label="把种荚木箱送上月线" employer="媛夕" wage="8"]\n[reputation: npc="媛夕" action="helped"]\n[choices: "帮媛夕把木箱送上月线"|"拿短工报酬后留在码头"|"问媛夕这些种子有什么用"]`
    : `You stop the last seed case with your shoe before it reaches the rail. It is no bigger than a walnut, with a pale light beneath its thin shell. The short-haired woman pins the crate with one knee and sweeps the others back onto the canvas. A narrow copper hairpin sits above her right ear; a matching seed-pod pendant hangs at her chest.\n\nThe shipping tag reads “Mira Voss, 28, Silverleaf field survey.” She fastens the lid, checks the rail, then looks up at you.\n\n[Mira Voss] [main] [relieved]: "The seeds turn toward moonlight. A moment more and the wheels would have crushed the lot. Help me get this crate aboard and I’ll pay you 8 coin."\n[character_update: character_id="mira-voss" character="Mira Voss" role="Age 28 · field botanist" detail="Securing luminous seed cases on Lantern Quay platform" vitality="82" stress="24"]\n[job: action="offer" id="mira-seed-crate" label="Load the seed crate onto the Moonline" employer="Mira Voss" wage="8"]\n[reputation: npc="Mira Voss" action="helped"]\n[choices: "Help Mira load the crate onto the Moonline"|"Take the short-job pay and stay at the quay"|"Ask Mira what the seeds are used for"]`
  const transit = zh
    ? `你和媛夕把木箱推进车厢。她把八枚钱币放进你手里，随后用皮带把箱子固定在座椅旁。\n\n车门合上，湿冷的月台被留在外面。列车启动后，夜市的灯一盏盏滑过雨痕斑驳的车窗。\n\n[job: action="settle" id="mira-seed-crate"]\n[clock: value="第一晚 · 19:08"]\n[map_update: new_location="月线车厢" connected_to="灯湾码头" detail="驶往银叶葡萄丘的晚班车"]\n[choices: "陪媛夕坐到银叶葡萄丘"|"问乘务员车上还有没有短工"|"在下一站拿着钱币独自下车"]`
    : `You and Mira roll the crate into the carriage. She places 8 coin in your hand, then straps the box beside the seat.\n\nThe doors close, leaving the wet platform outside. As the train pulls away, the market lamps pass one by one across the rain-streaked window.\n\n[job: action="settle" id="mira-seed-crate"]\n[clock: value="First evening · 19:08"]\n[map_update: new_location="Moonline Carriage" connected_to="Lantern Quay" detail="The late train to Silverleaf Vineyard"]\n[choices: "Ride with Mira to Silverleaf Vineyard"|"Ask the steward whether the train needs more help"|"Take the coin and get off alone at the next stop"]`
  const reunion = zh
    ? `列车在银叶站停稳。你穿过小月台，沿着泥路走进葡萄园。雨水压低了藤叶，叶面却正慢慢转向升起的月亮。\n\n两排葡萄藤之间，鼠尾草色外套、右侧铜发夹和胸前的坠饰让你认出了媛夕。媛夕对面的空凳旁放着干净杯子。远处的田舍亮着灯，葡萄行深处还传来剪枝的声音。\n\n[媛夕] [main] [坦率]: "短工已经结束了，酒不算报酬。那张凳子没人坐——至少现在没有。"\n[map_update: new_location="银叶葡萄丘" connected_to="月线车厢" detail="雨后的葡萄藤正在转向月光"]\n[clock: value="第一晚 · 19:36"]\n[reputation: npc="媛夕" action="kept-promise"]\n[choices: "坐到媛夕对面的空凳上"|"去亮着灯的田舍问过夜工作"|"沿葡萄行找还在剪枝的人"]`
    : `The train stops at Silverleaf. You cross the small platform and follow a muddy path into the vineyard. Rain has bowed the leaves; their wet surfaces are slowly turning toward the rising moon.\n\nBetween two rows of vines, the sage jacket, copper hairpin, and pendant make Mira easy to recognize. An empty stool stands across from Mira with a clean cup beside it. Farther off, the field house is lit, and pruning shears still click somewhere among the vine rows.\n\n[Mira Voss] [main] [direct]: "The job is over, so the wine isn’t payment. No one is using that stool—at least not yet."\n[map_update: new_location="Silverleaf Vineyard" connected_to="Moonline Carriage" detail="Rain-wet vines turning toward the moon"]\n[clock: value="First evening · 19:36"]\n[reputation: npc="Mira Voss" action="kept-promise"]\n[choices: "Sit on the empty stool across from Mira"|"Ask for overnight work at the lit field house"|"Follow the sound of pruning shears into the vine rows"]`
  const dynamicDebut = zh
    ? `葡萄行尽头，有人正把折断的藤枝绑回木架。那人把剪刀收进腰侧皮套，转过身来：二十九岁左右，深金色卷发垂到下颌，左鬓夹着一枚窄黄铜叶夹，肩上披着石蓝色短斗篷。\n\n田舍的窗户被推开。里面有人喊：“塔林，东边那排也断了两处。”\n\n塔林朝那边看了一眼，又低头看了看你沾满泥的鞋。\n\n[塔林] [main] [随和]: "如果你只想散步，我可以指一条干路。要是想赚点钱，就帮我把东边那两处绑好。"\n[character_update: character_id="talin-rey" character="塔林" role="29 岁 · 临时藤架修复师" detail="在银叶葡萄丘修补被雨压断的藤架" lore="来自潮汐群岛，做季节短工" vitality="79" stress="33" skills="修补: 4|识路: 3" visual_appearance="One grounded adult person age 29, androgynous lean build, light brown skin, jaw-length deep-golden curly hair, narrow brass leaf clip at the left temple, attentive gray eyes, stone-blue short travel cape, dark work shirt, pruning shears at belt, EDITORIAL GOUACHE PAINTING, opaque matte brush shapes, visible dry-brush edges, simplified but observant adult features, sophisticated contemporary travel illustration, no glossy 3D, no photorealism, natural anatomy, no text" visual_traits="age 29 adult presentation|jaw-length deep-golden curls|narrow brass leaf clip at left temple|light brown skin|attentive gray eyes" visual_wardrobe="stone-blue short cape|dark practical work shirt|weathered brass fasteners" visual_forbidden="teen appearance|long straight hair|missing brass leaf clip|school uniform|exaggerated anatomy"]\n[choices: "和塔林一起修东边的藤架"|"请塔林指一条不沾泥的路"|"回到媛夕对面的空凳上"]`
    : `At the end of a vine row, someone is tying a broken branch back to its wooden frame. They slide the shears into a belt sheath and turn: about twenty-nine, with deep-gold curls at the jaw, a narrow brass leaf clip at the left temple, and a short stone-blue cape.\n\nA window opens at the field house. Someone inside calls, “Talin, two more breaks in the east row.”\n\nTalin glances that way, then down at the mud covering your shoes.\n\n[Talin Rey] [main] [easygoing]: "If you’re only walking, I can point out a dry route. If you want coin, help me tie those two breaks in the east row."\n[character_update: character_id="talin-rey" character="Talin Rey" role="Age 29 · seasonal trellis repairer" detail="Repairing rain-damaged trellises at Silverleaf Vineyard" lore="Comes from the tidal islands for seasonal work" vitality="79" stress="33" skills="Repair: 4|Wayfinding: 3" visual_appearance="One grounded adult person age 29, androgynous lean build, light brown skin, jaw-length deep-golden curly hair, narrow brass leaf clip at the left temple, attentive gray eyes, stone-blue short travel cape, dark work shirt, pruning shears at belt, EDITORIAL GOUACHE PAINTING, opaque matte brush shapes, visible dry-brush edges, simplified but observant adult features, sophisticated contemporary travel illustration, no glossy 3D, no photorealism, natural anatomy, no text" visual_traits="age 29 adult presentation|jaw-length deep-golden curls|narrow brass leaf clip at left temple|light brown skin|attentive gray eyes" visual_wardrobe="stone-blue short cape|dark practical work shirt|weathered brass fasteners" visual_forbidden="teen appearance|long straight hair|missing brass leaf clip|school uniform|exaggerated anatomy"]\n[choices: "Help Talin repair the east-row trellis"|"Ask Talin to point out a mud-free path"|"Return to the empty stool across from Mira"]`

  const v1Turns = wanderlightV1Content(locale)
  const miraOpeningTurn = {
    match: zh ? ['种荚', '短发', '帮'] : ['seed', 'short-haired', 'help'],
    content: miraDebut,
    imagePrompt: 'Lantern Quay platform at blue hour, medium environmental shot of one adult field botanist securing luminous seed cases, short asymmetrical deep-brown bob, narrow copper hairpin above right ear, sage jacket and copper seed-pod pendant visible, player only as out-of-focus hand at frame edge, no text, no UI, 4:3',
    imageSubject: 'others' as const,
    imageCharacterId: 'mira-voss',
  }

  return {
    schemaVersion: 1, id: 'wanderlight', locale, coverImage, entryImage,
    copy: { title: s('漫游微光', 'Wanderlight'), subtitle: s('灯湾海岸 · 第一晚', 'Lantern Coast · first evening'), promise: s('找一份工作，赶上末班车，或者认识一个值得再见的人。', 'Find work, catch the last train, or meet someone worth seeing again.'), enter: s('走进灯湾', 'Enter Lantern Quay'), continue: s('继续漫游', 'Continue wandering'), customAction: s('也可以写下任何想做的事', 'Or write anything you want to do'), itemImagingTitle: s('正在绘制旅途物件', 'Drawing your travel item'), itemImagingBody: s('不用等待。图片完成后会留在行囊里。', 'No need to wait. The image will appear in your bag when ready.') },
    theme: { outer: '#101416', surface: '#192328', paper: '#E8E0CC', ink: '#233033', muted: '#71817C', accent: '#3D8E86', danger: '#C66B5B', gold: '#E4A56F', material: 'wayfarer' },
    audioTheme: { material: 'wayfarer', bpm: 68, rootHz: 146.83, scale: [0, 2, 5, 7, 9], levels: { music: 0.04, ambient: 0.12, sfx: 0.17, master: 0.72 }, tension: [{ statId: 'energy', direction: 'low', weight: 0.6 }, { statId: 'coin', direction: 'low', weight: 0.25 }, { statId: 'renown', direction: 'low', weight: 0.15 }] },
    itemImageDirection: `${GOUACHE}. EDITORIAL GOUACHE TRAVEL-OBJECT PLATE on painted indigo cloth and pale station stone. Unmistakably hand-painted opaque matte shapes, visible dry-brush edges and cold-press paper grain. Never photography, never photorealistic product rendering, no lens blur, no glossy studio lighting, object only, no people, no text`,
    sceneImageDirection: 'EDITORIAL GOUACHE PAINTING, opaque matte brush shapes, visible dry-brush edges, simplified but observant clearly adult features, deep indigo, mineral teal, sage and warm copper palette, one identity owner and one dominant action, restrained tension through distance and gesture, no readable text or UI',
    sceneImageAvoid: 'opening quay, same train exterior, three waiting silhouettes, generic rain street, centered avatar portrait',
    transitionAnchor: s('月线车厢或灯湾月台', 'the Moonline carriage or Lantern Quay platform'),
    imageDirector: { maxQuietTurns: 2, softCooldownTurns: 1, guaranteedTriggers: ['new-location', 'relationship-change', 'character-expression'], softTriggers: ['party-change', 'objective-change', 'chapter-checkpoint'] },
    director: { mode: 'open-world', fixedWorldRules: [s('所有可亲密角色明确为 24 岁以上成年人。', 'Every intimate character is explicitly aged 24 or older.'), s('人物只知道亲历或被告知的事实，约定与边界持续存在。', 'Characters know only witnessed or told facts; promises and boundaries persist.'), s('长期角色使用稳定 id，固化身份不能静默替换。', 'Recurring characters use stable ids and anchored identities cannot be silently replaced.'), s('跨地区移动先经过月线车厢或月台。', 'Cross-region travel passes through the Moonline carriage or platform.'), s('关系变化引用可见事件，不使用隐藏好感值。', 'Relationship changes cite visible events, not a hidden affection score.')], generationRules: [s('可创造符合当前地区的成年 NPC、工作和邀请。', 'You may create adult NPCs, jobs and invitations appropriate to the region.'), s('新 NPC 正式登场时使用稳定 id 和英文视觉身份字段。', 'A new NPC formal debut uses a stable id and English visual identity fields.'), s('暧昧来自共同活动、同意和边界，不描写露骨性行为。', 'Flirtation grows from shared activity, consent and boundaries, never explicit sex.'), s('每回合改变一项权威事实。', 'Every turn changes one authoritative fact.'), s('叙事先写清人物、动作与因果；质感来自可见细节和潜台词，不使用晦涩隐喻或幕后术语。', 'Narration makes actors, actions, and causality clear; texture comes from observable detail and subtext, never obscure metaphor or design jargon.'), s('每次最多引入一个陌生世界词，并立刻通过外形、用途或现场反应自然说明。', 'Introduce at most one unfamiliar world term at a time and explain it immediately through appearance, function, or an observable reaction.')], choiceIntents: [s('跟随某人或加深关系', 'follow someone or deepen a relationship'), s('探索地点或接受工作', 'explore a place or accept work'), s('保护时间、资源或边界', 'protect time, resources or a boundary')], maxActiveThreads: 3 },
    dangerDirector: { minSafeTurns: 3, maxSafeTurns: 5, cooldownTurns: 3, escalationStats: ['energy', 'coin', 'renown'], threatPalette: [s('末班月线突然取消', 'the last Moonline is cancelled'), s('私人邀请被公开复述', 'a private invitation is repeated publicly'), s('银雨封闭葡萄丘道路', 'silver rain closes the vineyard road'), s('夜市雇主拒绝按约支付', 'a night-market employer withholds payment')], methods: [s('询问并理解警告', 'ask for context'), s('承担代价保护承诺', 'protect a promise at a cost'), s('撤退、改道或设定边界', 'withdraw, reroute or set a boundary')], physicalCombat: 'none', resolution: { skill: s('判断', 'Judgment'), modifier: 2, dcBySeverity: [7, 9, 11, 13, 15], fallbackCosts: [{ statId: 'energy', operation: 'remove', amount: 12 }] } },
    initialFacts: { all_intimate_characters_adult: true, dynamic_identity_trial: true, moonline_stamps_used: 0, world_day: 1, jobs_completed: 0, meals_eaten: 0, nights_slept: 0, carriage_rests: 0, exhaustion_recoveries: 0 },
    statDefinitions: [
      {
        id: 'energy', label: s('精力', 'Energy'), min: 0, max: 100, initial: 72, display: 'bar', inverse: true, warningAt: 28, dangerAt: 8, maxDelta: 24,
        description: s('代表还能承受多少工作、赶路和危险。低于 28 会进入疲惫提醒，短工低于 12 无法进行；归零后只能先恢复。热饭 +12、客房 +28、车厢 +8。', 'How much work, travel, and danger you can still bear. Below 28 signals fatigue; shifts require 12; at zero you must recover first. Hot meal +12, room +28, carriage +8.'),
        floorRule: {
          threshold: 0,
          enteredText: s('你的精力已经耗尽。刚才的行动没有成功，原来的后果仍然存在；在恢复之前，你无法继续工作、赶路或深入探索。', 'Your energy is exhausted. The attempted action failed and its consequence remains; until you recover, you cannot work, travel, or push deeper.'),
          blockedText: s('你试着继续，但身体已经无法执行这个行动。先恢复精力；原来的地点、线索和约定不会因此消失。', 'You try to continue, but your body cannot carry out that action. Recover first; your location, clues, and promises remain.'),
          recoveryChoices: [s('原地坐下，休息四十五分钟', 'Sit down and rest for forty-five minutes'), s('放弃当前行动，去最近的公共休息处', 'Abandon the current action and reach the nearest public rest area'), s('结束今天，休息到清晨', 'End the day and rest until morning')],
          allowedDomainRuleIds: ['catch-breath', 'retreat-to-rest', 'rest-until-morning', 'hot-meal', 'overnight-room', 'carriage-rest'],
        },
      },
      { id: 'coin', label: s('钱币', 'Coins'), min: 0, max: 999, initial: 6, display: 'number', unit: s('枚', ''), description: s('代表可立即使用的旅费。普通车票 3 枚、热饭 4 枚、客房 10 枚；余额不足时不能透支，完成并结清工作后才会增加。', 'Spendable travel money. Ticket 3, hot meal 4, room 10; you cannot overdraw, and coins increase only when completed work is paid.'), inverse: true, warningAt: 3, dangerAt: 0, maxDelta: 30 },
      { id: 'renown', label: s('风闻', 'Standing'), min: -40, max: 100, initial: 4, display: 'bar', inverse: true, warningAt: -10, dangerAt: -30, maxDelta: 18, description: s('代表各地流传的公开名声，不是人物好感。完成工作、帮助他人和守约会提高；失约或造成公开麻烦可能降低。低于 −10 会提高危险压力，低于 −30 进入最高压力。', 'Your public reputation across the coast, not personal affection. Work, help, and kept promises raise it; broken promises or public trouble may lower it. Below −10 raises danger pressure; below −30 makes it critical.') },
    ],
    domainRules: domainRules(locale),
    drawerLabels: { party: s('人物关系', 'Relations'), map: s('路线', 'Routes'), inventory: s('行囊', 'Pack'), log: s('旅记', 'Journal') },
    opening: { location: s('灯湾码头', 'Lantern Quay'), time: s('第一晚 · 18:40', 'First evening · 18:40'), objective: s('在末班月线离站前挣到今晚的房钱。', 'Earn tonight’s room money before the last Moonline leaves.'), imagePrompt: `${GOUACHE}. Wide establishing view of a rain-wet coastal railway platform at blue hour. Foreground: one clearly adult traveler beside a plain suitcase, seen from behind. Midground: a dark blue night train with one open warm-lit door. Background: cliff town lights and a small covered market. Spacious composition, strong value grouping, no close-up faces, no lettering, no signs, no logos, no UI.`, blocks: [{ id: 'open-1', kind: 'narration', text: s('雨刚停。你提着行李走出灯湾渡口，口袋里的钱只够吃一顿饭，付不起整晚的房费。', 'The rain has just stopped. You leave the Lantern Quay ferry with your luggage and enough money for one meal, but not a full night’s room.') }, { id: 'open-2', kind: 'narration', text: s('末班月线四十分钟后离站。这是一列沿海岸行驶的夜班车。月台上，一名短发女人正追着几只滚向铁轨的发光种荚；不远处，乘务员举着一张缺人的夜班招工牌。', 'The last Moonline leaves in forty minutes. It is the night train that runs along the coast. On the platform, a short-haired woman is chasing luminous seed cases rolling toward the rail. Nearby, a steward holds up a sign for one vacant night shift.') }, { id: 'open-3', kind: 'narration', text: s('夜市的琴声忽然停了。雨棚后有人喊：“能来个人帮忙搬箱子吗？”三件事都能让你赚到今晚的房钱。', 'The music at the night market stops. Someone behind the awnings calls, “Can anyone help with these cases?” Any of the three jobs could pay for a room tonight.') }], choices: [{ id: 'help-seeds', label: s('帮短发女人拦住发光种荚', 'Help the short-haired woman catch the seed cases') }, { id: 'take-route-shift', label: s('接下乘务员的夜班工作', 'Take the steward’s vacant night shift') }, { id: 'follow-music', label: s('去夜市帮忙搬箱子', 'Help move cases at the night market') }], deterministicTurns: { 'help-seeds': miraOpeningTurn, 'take-route-shift': v1Turns[0], 'follow-music': v1Turns[4] } },
    characters: cast(locale),
    initialMap: worldMap(locale),
    initialInventory: [{ id: 'moonline-passbook', label: s('月线通行册', 'Moonline Passbook'), count: 1, rarity: 'rare', detail: s('蓝灰布封面的小册，夹着三枚无字银色印章。', 'A blue-gray cloth passbook holding three unlettered silver stamps.'), effect: s('每枚印章可为已发现路线换一次停运后的夜班席位。', 'Each stamp secures one after-hours seat on a discovered route.'), lore: s('灯湾月线给临时工作人员的旧式凭证。', 'An old credential issued to temporary Moonline workers.'), metrics: [{ id: 'stamps', label: s('剩余印章', 'Stamps remaining'), value: '3 / 3' }], imagePrompt: 'single blue-gray cloth railway passbook and EXACTLY THREE completely blank featureless silver circular stamp tokens arranged as one token above two tokens below; count 3 total, never 2 or 4; no marks or embossing on any token or cover, painted indigo cloth and pale station stone, object only, no hands, no text, no letters, no numbers, no symbols, square' }],
    demoTurns: [
      miraOpeningTurn,
      { match: zh ? ['送上月线', '月线'] : ['Moonline', 'load'], content: transit, imagePrompt: 'inside a warm Moonline carriage leaving Lantern Quay, rain-bright city lights outside, one secured seed crate and two separate seats, environmental transition with people only as small silhouettes, no text, no UI, 4:3', imageSubject: 'environment' },
      { match: zh ? ['葡萄丘', '陪媛夕'] : ['Silverleaf', 'ride with Mira'], content: reunion, imagePrompt: 'Silverleaf Vineyard after rain, medium shot of one adult botanist waiting beside two stools between moon-turning vines, same short asymmetrical deep-brown bob, narrow copper hairpin above right ear, sage jacket and copper pendant, player off-camera, no text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'mira-voss' },
      { match: zh ? ['剪枝', '葡萄行', '找'] : ['pruning shears', 'vine rows', 'follow'], content: dynamicDebut, imagePrompt: 'Silverleaf Vineyard at night, formal first identity anchor of one adult trellis repairer beside a rain-bent vine, jaw-length deep-golden curls, narrow brass leaf clip at left temple, stone-blue cape, no other readable face, no text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'talin-rey' },
      ...v1Turns,
      ...wanderlightV1Outcomes(locale),
    ],
  }
}

export const wanderlight = make('zh')
export const wanderlightEn = make('en')
