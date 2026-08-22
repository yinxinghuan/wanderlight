import type { CharacterDefinition, CharacterVisualIdentity, Locale, StoryCartridge } from '../types'
import { wanderlightV1Content } from './wanderlightV1Content'
import { wanderlightV1Outcomes } from './wanderlightV1Outcomes'
import {
  wanderlightExpansionCharacters,
  wanderlightExpansionDirector,
  wanderlightExpansionMap,
  wanderlightExpansionTravel,
  wanderlightExpansionTurns,
} from './wanderlightWorldExpansion'
import { wanderlightPresetEvents } from './wanderlightPresetEvents'

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
    ...wanderlightExpansionCharacters(locale),
  ]
}

function domainRules(locale: Locale): NonNullable<StoryCartridge['domainRules']> {
  const zh = locale === 'zh'
  const s = (cn: string, en: string) => zh ? cn : en
  const safeRecovery = {
    type: 'danger' as const,
    phases: ['calm' as const],
    reason: s('眼前的危险还没有解除，现在停下来休息会让你暴露其中。先应对危险，或撤退到安全的公共休息处。', 'The immediate danger is still active; stopping to rest would leave you exposed. Address it first, or withdraw to a safe public rest area.'),
  }
  const safeOrdinaryAction = {
    type: 'danger' as const,
    phases: ['calm' as const],
    reason: s('眼前的危险还没有解除，不能把它留在原地去工作或赶路。先应对危险，或明确撤退。', 'The immediate danger is still active; you cannot leave it behind by working or travelling. Address it first, or explicitly withdraw.'),
  }
  const travelDestinations = [
    { nodeId: 'silverleaf-vineyard', label: s('银叶葡萄丘', 'Silverleaf Vineyard'), intent: s('独自买票去银叶葡萄丘', 'buy a ticket to Silverleaf Vineyard'), arrivalChoices: [] as string[] },
    { nodeId: 'cupshadow-market', label: s('杯影夜市', 'Cupshadow Market'), intent: s('独自买票去杯影夜市', 'buy a ticket to Cupshadow Market'), arrivalChoices: [] as string[] },
    { nodeId: 'mistpine-forest', label: s('雾杉林', 'Mistpine Forest'), intent: s('独自买票去雾杉林', 'buy a ticket to Mistpine Forest'), arrivalChoices: [] as string[] },
    { nodeId: 'tidal-islands', label: s('潮汐群岛', 'Tidal Islands'), intent: s('独自买票去潮汐群岛', 'buy a ticket to the Tidal Islands'), arrivalChoices: [] as string[] },
    { nodeId: 'far-lantern-institute', label: s('远灯研修院', 'Far Lantern Institute'), intent: s('独自买票去远灯研修院', 'buy a ticket to Far Lantern Institute'), arrivalChoices: [] as string[] },
    { nodeId: 'lantern-quay', label: s('灯湾码头', 'Lantern Quay'), intent: s('独自买票回灯湾码头', 'buy a ticket back to Lantern Quay'), arrivalChoices: [] as string[] },
    ...wanderlightExpansionTravel(locale),
  ]
  return {
    authorityMode: 'shadow',
    legacyChoiceSets: [[
      s('接一份九十分钟短工（报酬 9 枚）', 'Take a ninety-minute shift (9 coin)'),
      s('吃一顿热饭', 'Get something to eat'),
      s('原地坐下，休息四十五分钟', 'Sit down and rest for forty-five minutes'),
      s('放弃当前行动，去最近的公共休息处', 'Abandon the current action and reach the nearest public rest area'),
      s('结束今天，休息到清晨', 'End the day and rest until morning'),
    ]],
    objectiveTransitions: [
      {
        from: s('在末班月线离站前挣到今晚的房钱。', 'Earn tonight’s room money before the last Moonline leaves.'),
        to: s('房钱已经足够；决定今晚住下、继续工作，还是搭月线离开。', 'You can afford a room; decide whether to stay, keep working, or take the Moonline.'),
        requirements: [
          { type: 'stat', id: 'coin', min: 10, reason: '' },
          { type: 'fact', id: 'lodging_secured', notEquals: true, reason: '' },
        ],
      },
      {
        from: s('房钱已经足够；决定今晚住下、继续工作，还是搭月线离开。', 'You can afford a room; decide whether to stay, keep working, or take the Moonline.'),
        to: s('在末班月线离站前挣到今晚的房钱。', 'Earn tonight’s room money before the last Moonline leaves.'),
        requirements: [
          { type: 'stat', id: 'coin', max: 9, reason: '' },
          { type: 'fact', id: 'lodging_secured', notEquals: true, reason: '' },
        ],
      },
    ],
    rules: [
      {
        id: 'clarify-spending-target', intent: s('澄清钱要花在什么上', 'clarify what the money should buy'),
        matchMode: 'exact',
        match: zh
          ? ['把钱全部花完', '把所有钱都花掉', '把钱花完', '花光所有钱', '把剩下的钱都花掉']
          : ['spend all my money', 'spend every coin', 'spend the rest of my money', 'use up all my money'],
        requirements: [],
        effects: [],
        successContinuation: 'resume',
        successText: s('你还没有说明想买什么，所以没有发生交易，余额保持不变。先选定具体的商品或服务，系统才会确认价格并扣款。', 'You have not said what you want to buy, so no transaction occurs and your balance stays unchanged. Choose a specific good or service before any price is confirmed or coin is deducted.'),
        successChoices: [],
      },
      {
        id: 'catch-breath', intent: s('原地休息四十五分钟', 'rest in place for forty-five minutes'),
        choiceLabel: s('原地坐下，休息四十五分钟', 'Sit down and rest for forty-five minutes'), recommend: true, rank: 40,
        match: [s('原地坐下，休息四十五分钟', 'sit down and rest for forty-five minutes'), s('再休息四十五分钟', 'rest for another forty-five minutes'), s('原地休息', 'rest in place'), s('慢慢恢复呼吸', 'catch my breath'), s('休息', 'rest'), s('歇一会', 'take a break'), s('小睡', 'nap'), s('眯一会', 'doze')],
        intentGuard: 'rest-commitment',
        dangerPolicy: 'suppress',
        successContinuation: 'resume',
        rejectionContinuation: 'resume',
        requirements: [safeRecovery],
        effects: [{ type: 'stat', id: 'energy', delta: 8 }, { type: 'clock-add', minutes: 45 }, { type: 'fact-add', id: 'exhaustion_recoveries', delta: 1 }],
        successText: s('你不再勉强往前走，而是原地坐下，等呼吸和双腿慢慢恢复。四十五分钟后，你重新有了行动的力气。', 'You stop forcing yourself onward and sit until your breathing and legs steady. Forty-five minutes later, you can move again.'),
        successChoices: [],
        rejectionChoices: [],
      },
      {
        id: 'retreat-to-rest', intent: s('前往最近的公共休息处', 'reach the nearest public rest area'),
        choiceLabel: s('去最近的公共休息处', 'Reach the nearest public rest area'), recommend: true, rank: 90,
        match: [s('放弃当前行动，去最近的公共休息处', 'abandon the current action and reach the nearest public rest area'), s('去最近的公共休息处', 'reach the nearest public rest area'), s('找公共休息处', 'find a public rest area')],
        intentGuard: 'rest-commitment',
        dangerPolicy: 'withdraw',
        successContinuation: 'derive',
        rejectionContinuation: 'resume',
        requirements: [],
        effects: [{ type: 'stat', id: 'energy', delta: 16 }, { type: 'clock-add', minutes: 120 }, { type: 'fact-add', id: 'exhaustion_recoveries', delta: 1 }],
        successText: s('你放弃原来的安排，沿途停了几次，终于到达最近的公共休息处。两小时过去，错过的行程不会倒转，但你已经能够继续行动。', 'You abandon the original plan and stop several times before reaching the nearest public rest area. Two hours pass; the missed plan will not rewind, but you can move again.'),
        successChoices: [],
        rejectionChoices: [],
      },
      {
        id: 'rest-until-morning', intent: s('结束今天并休息到清晨', 'end the day and rest until morning'),
        choiceLabel: s('结束今天，休息到清晨', 'End the day and rest until morning'), recommend: true, rank: 100,
        match: [s('结束今天，休息到清晨', 'end the day and rest until morning'), s('休息到清晨', 'rest until morning'), s('今天不再行动', 'stop for the day')],
        intentGuard: 'rest-commitment',
        dangerPolicy: 'suppress',
        successContinuation: 'checkpoint',
        rejectionContinuation: 'resume',
        requirements: [safeRecovery],
        effects: [{ type: 'stat', id: 'energy', delta: 36 }, { type: 'clock-add', minutes: 600 }, { type: 'fact-add', id: 'exhaustion_recoveries', delta: 1 }, { type: 'session', ended: true, reason: s('你结束了今天的行动。地点、人物和约定都已保存；下次回来时，从休息后的清晨继续。', 'You end the day. Places, people, and promises are saved; the next visit begins after your morning rest.') }],
        successText: s('你不再追赶今晚剩下的安排，找到能避风的地方休息。睡意很快盖过远处的声响。', 'You stop chasing the rest of tonight’s plans and find shelter from the wind. Sleep soon covers the distant sounds.'),
        successChoices: [],
        rejectionChoices: [],
      },
      {
        id: 'local-shift', intent: s('完成一份当地短工', 'complete a local shift'),
        choiceLabel: s('找一份短工', 'Look for a short job'), recommend: true, rank: 10,
        match: [s('接一份九十分钟短工（报酬 9 枚）', 'take a ninety-minute shift (9 coin)'), s('找一份短工', 'look for a short job'), s('再找一份短工', 'look for another short job'), s('另外找一份短工', 'find another short job'), s('找另一份班', 'find another shift'), s('再接一班', 'take another shift'), s('再做一份短工', 'do another short job'), s('做短工', 'take a local shift'), s('继续干活', 'keep working'), s('帮忙干活', 'help with the work'), s('完成这份工作', 'finish the job'), s('干完这份活', 'complete the shift'), s('结清工钱', 'collect my pay'), s('领取报酬', 'receive the payment')],
        repeatPolicy: {
          scope: 'location-day',
          reason: s('这个地点今天能立即结算的临时工作已经做完了。去新的地点查看工作，或休息到第二天再来。', 'You already completed the immediately available shift here today. Check another place for work, or return on a new day.'),
        },
        successContinuation: 'resume',
        rejectionContinuation: 'resume',
        requirements: [
          safeOrdinaryAction,
          { type: 'capability', id: 'local-shift', reason: s('这里没有已经确认、可以立即开工并结算的短工。先查看当前地点的告示或向现场的人询问。', 'There is no confirmed shift here that can begin and settle now. Check this place’s notices or ask someone present first.') },
          { type: 'stat', id: 'energy', min: 12, reason: s('你太累了，手上的活已经开始出错。先吃点东西或休息。', 'You are too tired to work safely. Eat or rest first.') },
        ],
        effects: [{ type: 'stat', id: 'energy', delta: -10 }, { type: 'stat', id: 'coin', delta: 9 }, { type: 'stat', id: 'renown', delta: 2 }, { type: 'clock-add', minutes: 90 }, { type: 'fact-add', id: 'jobs_completed', delta: 1 }],
        successText: s('你在附近的临时告示上接下一份九十分钟的装卸与整理工作。负责人先确认报酬是九枚钱币；你搬完最后一箱并核对清单后，对方把九枚钱币当场交给你。附近的人也开始认得你。', 'You take a ninety-minute loading and sorting shift from a nearby notice. The supervisor confirms the wage is 9 coin; after you move the final crate and check the list, they pay all 9 coin on the spot. A few people nearby begin to recognize you.'),
        successChoices: [],
        rejectionChoices: [],
      },
      {
        id: 'hot-meal', intent: s('吃一顿热饭', 'eat a hot meal'),
        choiceLabel: s('吃一顿热饭', 'Eat a hot meal'), recommend: true, rank: 20,
        match: [s('吃一顿热饭', 'eat a hot meal'), s('吃点东西', 'get something to eat'), s('买一顿饭', 'buy a meal')],
        dangerPolicy: 'suppress',
        successContinuation: 'resume',
        rejectionContinuation: 'resume',
        requirements: [safeRecovery, { type: 'capability', id: 'hot-meal', reason: s('眼前没有正在供应热饭的摊位或食堂，不能直接完成这笔消费。', 'There is no stall or canteen serving a hot meal here, so this purchase cannot be completed.') }, { type: 'stat', id: 'coin', min: 4, reason: s('你还差几枚钱币，摊主没有答应赊账。', 'You are a few coin short, and the vendor will not open a tab.') }],
        effects: [{ type: 'stat', id: 'coin', delta: -4 }, { type: 'stat', id: 'energy', delta: 12 }, { type: 'clock-add', minutes: 35 }, { type: 'fact-add', id: 'meals_eaten', delta: 1 }],
        successText: s('你吃完一碗冒着热气的炖菜，坐到双手不再发冷才起身。', 'You finish a bowl of hot stew and stay seated until your hands stop feeling cold.'),
        successChoices: [],
        rejectionChoices: [],
      },
      {
        id: 'overnight-room', intent: s('住一晚并保存', 'stay overnight and save'),
        choiceLabel: s('找个房间过夜', 'Get a room for the night'), recommend: true, rank: 30,
        match: [s('住一晚', 'stay for the night'), s('今晚住下', 'stay overnight'), s('住到明早', 'stay the night'), s('租个房间', 'rent a room'), s('租这间房', 'rent the room'), s('找个房间过夜', 'get a room for the night'), s('在旅店休息', 'rest at the inn'), s('支付房费', 'pay for the room'), s('付房费', 'pay the room fee'), s('订一间房', 'book a room'), s('订这间房', 'book the room'), s('预订房间', 'reserve a room')],
        intentGuard: 'rest-commitment',
        dangerPolicy: 'suppress',
        successContinuation: 'checkpoint',
        rejectionContinuation: 'resume',
        requirements: [safeRecovery, { type: 'capability', id: 'lodging', reason: s('当前地点没有已经确认可入住的客房，不能直接扣款订房。', 'No available room has been confirmed at this location, so a booking cannot be charged.') }, { type: 'stat', id: 'coin', min: 10, reason: s('房费是十枚钱币，你现在付不起。', 'The room costs ten coin, which you cannot afford yet.') }],
        effects: [{ type: 'stat', id: 'coin', delta: -10 }, { type: 'stat', id: 'energy', delta: 28 }, { type: 'clock-add', minutes: 660 }, { type: 'fact-add', id: 'nights_slept', delta: 1 }, { type: 'fact', id: 'lodging_secured', value: true }, { type: 'session', ended: true, reason: s('你关上房门。今晚的地点、人物和约定都已保存；下次回来时，从清晨继续。', 'You close the door. Tonight’s places, people, and promises are saved; the next visit begins in the morning.') }],
        successText: s('热水、干床单和一扇能锁上的门，让这一天终于停了下来。', 'Hot water, dry sheets, and a door that locks finally bring the day to a stop.'),
        successChoices: [],
        rejectionChoices: [],
      },
      {
        id: 'carriage-rest', intent: s('在月线车厢休息', 'rest in the Moonline carriage'),
        choiceLabel: s('靠着车窗休息', 'Rest by the window'), recommend: true, rank: 25,
        match: [s('在车厢休息', 'rest in the carriage'), s('在车上眯一会', 'nap on the train'), s('靠着车窗休息', 'rest by the window')],
        intentGuard: 'rest-commitment',
        dangerPolicy: 'suppress',
        successContinuation: 'resume',
        rejectionContinuation: 'resume',
        requirements: [safeRecovery, { type: 'map', nodeId: 'moonline-carriage', reason: s('你得先上月线，才能在车厢里休息。', 'You need to board the Moonline before you can rest in its carriage.') }],
        effects: [{ type: 'stat', id: 'energy', delta: 8 }, { type: 'clock-add', minutes: 45 }, { type: 'fact-add', id: 'carriage_rests', delta: 1 }],
        successText: s('你靠着温热的车窗闭了一会儿眼。列车没有停，但肩膀终于放松下来。', 'You close your eyes against the warm window. The train keeps moving, but the tension leaves your shoulders.'),
        successChoices: [],
        rejectionChoices: [],
      },
      ...travelDestinations.map(({ nodeId, label, intent, arrivalChoices }) => ({
        id: `travel-${nodeId}`,
        intent,
        choiceLabel: intent,
        recommend: true,
        rank: 50,
        match: [intent, s(`独自前往${label}`, `travel alone to ${label}`), s(`买票前往${label}`, `buy passage to ${label}`)],
        requirements: [
          safeOrdinaryAction,
          { type: 'map' as const, notNodeId: nodeId, reason: s(`你已经在${label}。`, `You are already at ${label}.`) },
          { type: 'stat' as const, id: 'coin', min: 3, reason: s('普通车票需要三枚钱币。你可以先接短工，或找乘务员谈谈。', 'A regular ticket costs three coin. Take a short job or speak with the steward first.') },
          { type: 'stat' as const, id: 'energy', min: 2, reason: s('你连走到月台都很勉强。先休息一下。', 'You are too tired even to reach the platform. Rest first.') },
        ],
        successContinuation: arrivalChoices.length ? 'replace' as const : 'derive' as const,
        rejectionContinuation: 'resume' as const,
        effects: [{ type: 'stat' as const, id: 'coin', delta: -3 }, { type: 'stat' as const, id: 'energy', delta: -2 }, { type: 'clock-add' as const, minutes: 55 }, { type: 'map' as const, nodeId }],
        successText: s(`你买好车票，先回到月台。列车关门后，旧地点的灯从湿玻璃上退远；再次开门时，${label}已经在外面。`, `You buy a ticket and return to the platform. The old lights recede across the wet glass; when the doors open again, ${label} is outside.`),
        successChoices: arrivalChoices,
        rejectionChoices: [],
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
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('渡口、月线总站和临时招工点都在这片湿石广场上。', 'The ferry, Moonline terminal, and day-labor posts share this wet-stone square.'),
      routeHints: zh ? ['灯湾码头', '渡口', '湿石广场', '招工点'] : ['Lantern Quay', 'ferry', 'wet-stone square', 'day-labor posts'],
      facts: [s('末班月线 19:20 离站', 'Last Moonline leaves at 19:20'), s('可做路线整理和码头搬运', 'Route sorting and dock hauling pay on completion'), s('渡口食堂和楼上旅店整夜营业', 'The ferry canteen and upstairs inn stay open all night'), s('总站路线牌列有风玻璃崖、芦水渡村、白浪浴镇、旧石坑花园和云阶果园', 'The terminal route board lists Windglass Cliffs, Reedwater Crossing, Whitecap Baths, Old Quarry Gardens, and Cloudstep Orchard')],
    },
    {
      id: 'moonline-carriage', label: s('月线车厢', 'Moonline Carriage'), connectedTo: s('灯湾码头', 'Lantern Quay'),
      capabilities: ['carriage-rest'],
      detail: s('开往海岸各地的夜班车厢，适合在途中休息和保存进度。', 'A night carriage serving the coast, with time to rest and save along the way.'),
      routeHints: zh ? ['月线车厢', '车厢', '列车', '车窗'] : ['Moonline Carriage', 'carriage', 'train', 'train window'],
      facts: [s('靠窗休息可恢复精力但会推进时间', 'Window-seat rest restores energy while time advances'), s('乘务员会说明下一站的工作与住宿', 'Stewards can explain work and lodging at the next stop'), s('车门旁的沿线图可以查看十个目的地区域', 'The route diagram beside the doors shows ten destination regions')],
    },
    {
      id: 'cupshadow-market', label: s('杯影夜市', 'Cupshadow Market'), connectedTo: s('灯湾码头', 'Lantern Quay'),
      capabilities: ['local-shift', 'hot-meal', 'public-rest'],
      detail: s('雨棚下有演出、食摊、搬运和布台短工。', 'Awnings shelter performances, food stalls, hauling, and stage work.'),
      routeHints: zh ? ['杯影夜市', '夜市', '雨棚', '舞台', '食摊'] : ['Cupshadow Market', 'night market', 'awnings', 'stage', 'food stalls'],
      facts: [s('搬运和布台按场结算', 'Hauling and stage setup pay after each show'), s('共餐长桌是认识摊主和乐师的地方', 'A shared supper table brings vendors and musicians together'), s('闭市后可回灯湾旅店休息', 'The Lantern Quay inn remains available after closing'), s('演出用的湿织物通常送往白浪浴镇清洗', 'Wet performance cloth is usually sent to Whitecap Baths for washing')],
    },
    {
      id: 'silverleaf-vineyard', label: s('银叶葡萄丘', 'Silverleaf Vineyard'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('葡萄藤随月光转向，田舍常雇季节短工。', 'Moon-turning vines and field houses that hire seasonal workers.'),
      routeHints: zh ? ['银叶葡萄丘', '葡萄丘', '葡萄园', '葡萄行', '葡萄藤', '藤架', '田野', '田舍'] : ['Silverleaf Vineyard', 'vineyard', 'grape rows', 'grapevines', 'trellis', 'fields', 'field house'],
      facts: [s('藤架修补和田野记录需要短工', 'Trellis repair and field surveys need temporary help'), s('晚餐长桌与试饮不要求发展亲密关系', 'Supper and tasting invitations carry no romantic obligation'), s('田舍有十枚钱币的客房', 'The field house rents rooms for ten coin'), s('最近的花粉蛾从云阶果园改变了迁飞方向', 'Pollinating moths from Cloudstep Orchard recently changed their route')],
    },
    {
      id: 'mistpine-forest', label: s('雾杉林', 'Mistpine Forest'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('有安全栈道、菌类调查和林灯维护工作。', 'Safe boardwalks, mushroom surveys, and forest-lamp maintenance.'),
      routeHints: zh ? ['雾杉林', '林地', '栈道', '菌类', '林灯', '护林人'] : ['Mistpine Forest', 'forest', 'boardwalk', 'mushrooms', 'forest lamps', 'rangers'],
      facts: [s('菌类调查和林灯维护按路线结算', 'Mushroom surveys and lamp maintenance pay by route'), s('护林人共用的茶棚适合交换消息', 'A ranger tea shelter is used for news and company'), s('夜间只能在灯屋或月线站休息', 'Night rest is limited to lamp houses or the Moonline stop')],
    },
    {
      id: 'tidal-islands', label: s('潮汐群岛', 'Tidal Islands'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('退潮时木桥连起渔业、修网和乐器工坊。', 'At low tide, bridges link fishing, net-mending, and instrument workshops.'),
      routeHints: zh ? ['潮汐群岛', '群岛', '浅滩', '木栈桥', '渔网', '修网'] : ['Tidal Islands', 'islands', 'tidal flats', 'wooden bridge', 'fishing nets', 'net mending'],
      facts: [s('修网和码头搬运在涨潮前结算', 'Net mending and landing work pay before high tide'), s('清晨演出和公共灶台是主要社交场所', 'Dawn performances and the public stove are social gathering places'), s('涨潮后可住桥头客舍或搭月线离开', 'After high tide, use the bridgehead guesthouse or leave by Moonline'), s('芦水渡村的木水闸控制一条补给水路', 'A wooden lock gate at Reedwater Crossing controls one supply route')],
    },
    {
      id: 'far-lantern-institute', label: s('远灯研修院', 'Far Lantern Institute'), connectedTo: s('月线车厢', 'Moonline Carriage'),
      capabilities: ['local-shift', 'hot-meal', 'lodging', 'public-rest'],
      detail: s('只招收成年人的职业与实用魔法研修院。', 'An adult institute for trades and practical magic.'),
      routeHints: zh ? ['远灯研修院', '研修院', '工坊', '陶轮', '修理台', '观测仪'] : ['Far Lantern Institute', 'institute', 'workshop', 'pottery wheel', 'repair bench', 'observatory instruments'],
      facts: [s('夜间工坊会发布修理与记录工作', 'Night workshops post repair and recording jobs'), s('开放讲座和公共工作台允许访客参加', 'Open lectures and shared benches welcome adult visitors'), s('空余客房每晚十枚钱币', 'Available guest rooms cost ten coin per night'), s('天气记录来自风玻璃崖，修复用旧石件来自旧石坑花园', 'Weather records arrive from Windglass Cliffs and restoration stone from Old Quarry Gardens')],
    },
    ...wanderlightExpansionMap(locale),
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
    : `The train stops at Silverleaf. You cross the small platform and follow a muddy path into the vineyard. Rain has bowed the leaves; their wet surfaces are slowly turning toward the rising moon.\n\nBetween two rows of vines, the sage jacket, copper hairpin, and pendant make Mira easy to recognize. An empty stool stands across from Mira with a clean cup beside it. Farther off, the field house is lit, and the sound of pruning shears still comes from among the vine rows.\n\n[Mira Voss] [main] [direct]: "The job is over, so the wine isn’t payment. No one is using that stool—at least not yet."\n[map_update: new_location="Silverleaf Vineyard" connected_to="Moonline Carriage" detail="Rain-wet vines turning toward the moon"]\n[clock: value="First evening · 19:36"]\n[reputation: npc="Mira Voss" action="kept-promise"]\n[choices: "Sit on the empty stool across from Mira"|"Ask for overnight work at the lit field house"|"Follow the sound of pruning shears into the vine rows"]`
  const dynamicDebut = zh
    ? `葡萄行尽头，有人正把折断的藤枝绑回木架。那人把剪刀收进腰侧皮套，转过身来：二十九岁左右，深金色卷发垂到下颌，左鬓夹着一枚窄黄铜叶夹，肩上披着石蓝色短斗篷。\n\n田舍的窗户被推开。里面有人喊：“塔林，东边那排也断了两处。”\n\n塔林朝那边看了一眼，又低头看了看你沾满泥的鞋。\n\n[塔林] [main] [随和]: "如果你只想散步，我可以指一条干路。要是想赚点钱，就帮我把东边那两处绑好。"\n[character_update: character_id="talin-rey" character="塔林" role="29 岁 · 临时藤架修复师" detail="在银叶葡萄丘修补被雨压断的藤架" lore="来自潮汐群岛，做季节短工" vitality="79" stress="33" skills="修补: 4|识路: 3" visual_appearance="One grounded adult person age 29, androgynous lean build, light brown skin, jaw-length deep-golden curly hair, narrow brass leaf clip at the left temple, attentive gray eyes, stone-blue short travel cape, dark work shirt, pruning shears at belt, EDITORIAL GOUACHE PAINTING, opaque matte brush shapes, visible dry-brush edges, simplified but observant adult features, sophisticated contemporary travel illustration, no glossy 3D, no photorealism, natural anatomy, no text" visual_traits="age 29 adult presentation|jaw-length deep-golden curls|narrow brass leaf clip at left temple|light brown skin|attentive gray eyes" visual_wardrobe="stone-blue short cape|dark practical work shirt|weathered brass fasteners" visual_forbidden="teen appearance|long straight hair|missing brass leaf clip|school uniform|exaggerated anatomy"]\n[choices: "和塔林一起修东边的藤架"|"请塔林指一条不沾泥的路"|"回到媛夕对面的空凳上"]`
    : `At the end of a vine row, someone is tying a broken branch back to its wooden frame. They slide the shears into a belt sheath and turn: about twenty-nine, with deep-gold curls at the jaw, a narrow brass leaf clip at the left temple, and a short stone-blue cape.\n\nA window opens at the field house. Someone inside says, “Talin Rey, two more breaks in the east row.”\n\nTalin glances that way, then down at the mud covering your shoes.\n\n[Talin Rey] [main] [easygoing]: "If you’re only walking, I can point out a dry route. If you want coin, help me tie those two breaks in the east row."\n[character_update: character_id="talin-rey" character="Talin Rey" role="Age 29 · seasonal trellis repairer" detail="Repairing rain-damaged trellises at Silverleaf Vineyard" lore="Comes from the tidal islands for seasonal work" vitality="79" stress="33" skills="Repair: 4|Wayfinding: 3" visual_appearance="One grounded adult person age 29, androgynous lean build, light brown skin, jaw-length deep-golden curly hair, narrow brass leaf clip at the left temple, attentive gray eyes, stone-blue short travel cape, dark work shirt, pruning shears at belt, EDITORIAL GOUACHE PAINTING, opaque matte brush shapes, visible dry-brush edges, simplified but observant adult features, sophisticated contemporary travel illustration, no glossy 3D, no photorealism, natural anatomy, no text" visual_traits="age 29 adult presentation|jaw-length deep-golden curls|narrow brass leaf clip at left temple|light brown skin|attentive gray eyes" visual_wardrobe="stone-blue short cape|dark practical work shirt|weathered brass fasteners" visual_forbidden="teen appearance|long straight hair|missing brass leaf clip|school uniform|exaggerated anatomy"]\n[choices: "Help Talin repair the east-row trellis"|"Ask Talin to point out a mud-free path"|"Return to the empty stool across from Mira"]`

  const v1Turns = wanderlightV1Content(locale)
  const v1Outcomes = wanderlightV1Outcomes(locale)
  const expansionTurns = wanderlightExpansionTurns(locale)
  const expansionDirector = wanderlightExpansionDirector(locale)
  const vineyardRoadThreat = s('银雨封闭葡萄丘道路', 'silver rain closes the vineyard road')
  const marketEmployerThreat = s('夜市雇主拒绝按约支付', 'a night-market employer withholds payment')
  const windglassThreat = s('风玻璃崖的信号灯被盐雾遮住', 'salt fog hides the Windglass signal lamp')
  const reedwaterThreat = s('芦水渡村的水闸在涨潮前卡死', 'the Reedwater lock gate jams before high tide')
  const whitecapThreat = s('白浪浴镇的热水管突然停流', 'hot water stops flowing at Whitecap Baths')
  const quarryThreat = s('旧石坑花园的蓄雨渠越过安全水位', 'the Old Quarry rain channel rises above its safe mark')
  const orchardThreat = s('云阶果园的授粉灯引错了蛾群', "Cloudstep's pollination lamps draw the moths off course")
  const parcelThreat = s('沿线邮袋里出现两件地址相同的包裹', 'two parcels in the route bag carry the same address')
  const dangerThreats = [
    s('末班月线突然取消', 'the last Moonline is cancelled'),
    s('私人邀请被公开复述', 'a private invitation is repeated publicly'),
    vineyardRoadThreat,
    marketEmployerThreat,
    ...expansionDirector.threats,
  ]
  const threatLocations = {
    [vineyardRoadThreat]: ['silverleaf-vineyard'],
    [marketEmployerThreat]: ['cupshadow-market'],
    [windglassThreat]: ['windglass-cliffs'],
    [reedwaterThreat]: ['reedwater-crossing'],
    [whitecapThreat]: ['whitecap-baths'],
    [quarryThreat]: ['old-quarry-gardens'],
    [orchardThreat]: ['cloudstep-orchard'],
    [parcelThreat]: ['cloudstep-orchard'],
  }
  const miraOpeningTurn = {
    match: zh ? ['种荚', '短发', '帮'] : ['seed', 'short-haired', 'help'],
    content: miraDebut,
    imagePrompt: 'Lantern Quay platform at blue hour, medium environmental shot of one adult field botanist securing luminous seed cases, short asymmetrical deep-brown bob, narrow copper hairpin above right ear, sage jacket and copper seed-pod pendant visible, player only as out-of-focus hand at frame edge, no text, no UI, 4:3',
    imageSubject: 'others' as const,
    imageCharacterId: 'mira-voss',
  }

  const safeLocalChoices = [
    s('接一份九十分钟短工（报酬 9 枚）', 'Take a ninety-minute shift (9 coin)'),
    s('吃一顿热饭', 'Get something to eat'),
    s('原地坐下，休息四十五分钟', 'Sit down and rest for forty-five minutes'),
  ]
  const choicesCommand = (choices = safeLocalChoices) => `[choices: ${choices.map((choice) => `"${choice}"`).join('|')}]`
  const localSideTurn = (
    action: string,
    location: string,
    body: string,
    options: { characterIds?: string[]; destination?: string; connectedTo?: string; choices?: string[] } = {},
  ): NonNullable<StoryCartridge['deterministicChoiceTurns']>[number] => {
    const destination = options.destination ?? location
    const transition = options.destination
      ? `\n[map_update: new_location="${options.destination}" connected_to="${options.connectedTo ?? location}"]`
      : ''
    return {
      action,
      when: { locations: [location], ...(options.characterIds ? { characterIds: options.characterIds } : {}) },
      turn: { match: [], content: `${body}${transition}\n[scene_location: location="${destination}"]\n${choicesCommand(options.choices)}` },
    }
  }

  const deterministicChoiceTurns: NonNullable<StoryCartridge['deterministicChoiceTurns']> = [
    ...expansionTurns.deterministic,
    {
      action: s('帮媛夕把木箱送上月线', 'Help Mira load the crate onto the Moonline'),
      when: { locations: [s('灯湾码头', 'Lantern Quay')], characterIds: ['mira-voss'], jobs: [{ id: 'mira-seed-crate', statuses: ['offered', 'accepted'] }] },
      turn: { match: [], content: transit, imagePrompt: 'inside a warm Moonline carriage leaving Lantern Quay, rain-bright city lights outside, one secured seed crate and two separate seats, environmental transition with people only as small silhouettes, no text, no UI, 4:3', imageSubject: 'environment' },
    },
    { action: s('陪媛夕坐到银叶葡萄丘', 'Ride with Mira to Silverleaf Vineyard'), when: { locations: [s('月线车厢', 'Moonline Carriage')], characterIds: ['mira-voss'] }, turn: { match: [], content: reunion, imagePrompt: 'Silverleaf Vineyard after rain, medium shot of one adult botanist waiting beside two stools between moon-turning vines, same short asymmetrical deep-brown bob, narrow copper hairpin above right ear, sage jacket and copper pendant, player off-camera, no text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'mira-voss' } },
    { action: s('坐到媛夕对面的空凳上', 'Sit on the empty stool across from Mira'), when: { locations: [s('银叶葡萄丘', 'Silverleaf Vineyard')], characterIds: ['mira-voss'] }, turn: v1Outcomes[0] },
    { action: s('答应清晨和媛夕一起调查葡萄藤', "Join Mira's dawn vine survey"), when: { locations: [s('银叶葡萄丘', 'Silverleaf Vineyard')], characterIds: ['mira-voss'] }, turn: v1Outcomes[1] },
    { action: s('帮罗温把泡皱的地图压平', 'Help Rowan flatten the buckled map'), when: { locations: [s('灯湾码头', 'Lantern Quay')], characterIds: ['rowan-hale'] }, turn: v1Turns[1] },
    { action: s('和罗温把地图送去远灯研修院', 'Deliver the map to Far Lantern Institute with Rowan'), when: { locations: [s('灯湾码头', 'Lantern Quay')], characterIds: ['rowan-hale'] }, turn: v1Turns[2] },
    { action: s('和罗温谈谈那张缺失的海岸线', 'Ask Rowan about the missing stretch of coast'), when: { locations: [s('月线车厢', 'Moonline Carriage')], characterIds: ['rowan-hale'] }, turn: v1Turns[3] },
    { action: s('请罗温介绍修窑门的工作', 'Ask Rowan to introduce the kiln-door job'), when: { locations: [s('远灯研修院', 'Far Lantern Institute')], characterIds: ['rowan-hale'] }, turn: v1Outcomes[2] },
    { action: s('答应明早和罗温检查通往雾杉林的旧支线', "Join Rowan's morning inspection of the Mistpine branch"), when: { locations: [s('远灯研修院', 'Far Lantern Institute')], characterIds: ['rowan-hale'] }, turn: v1Outcomes[3] },
    { action: s('帮塞莱斯特把折叠椅也摆好', 'Help Celeste arrange the folding chairs'), when: { locations: [s('杯影夜市', 'Cupshadow Market')], characterIds: ['celeste-ardin'] }, turn: v1Turns[5] },
    { action: s('和塞莱斯特去潮汐群岛', 'Take the Moonline to the Tidal Islands with Celeste'), when: { locations: [s('杯影夜市', 'Cupshadow Market')], characterIds: ['celeste-ardin'] }, turn: v1Turns[6] },
    { action: s('问塞莱斯特那场清晨演出唱给谁听', 'Ask who the dawn concert is for'), when: { locations: [s('月线车厢', 'Moonline Carriage')], characterIds: ['celeste-ardin'] }, turn: v1Turns[7] },
    { action: s('帮塞莱斯特试场', 'Help Celeste check the dawn performance space'), when: { locations: [s('潮汐群岛', 'Tidal Islands')], characterIds: ['celeste-ardin'] }, turn: v1Outcomes[4] },
    { action: s('接受塞莱斯特下一站的布台工作', "Take Celeste's staging job at the next market"), when: { locations: [s('潮汐群岛', 'Tidal Islands')], characterIds: ['celeste-ardin'] }, turn: v1Outcomes[5] },
  ]

  deterministicChoiceTurns.push(
    ...(
      zh
        ? [
            localSideTurn('拿短工报酬后留在码头', '灯湾码头', '你把木箱搬到月线货运门口，确认固定带扣稳，却没有跟着上车。媛夕验收后把约定的八枚钱币交给你。你收好钱币留在灯湾码头；这里仍有短工、热饭和公共长凳。\n[job: action="settle" id="mira-seed-crate"]', { characterIds: ['mira-voss'] }),
            localSideTurn('问媛夕这些种子有什么用', '灯湾码头', '媛夕把一枚种荚托在掌心。它会顺着月光改变生长方向；她正把这一批送去银叶葡萄丘，比较雨后葡萄藤的反应。她确认木箱仍等着装上末班月线。', { characterIds: ['mira-voss'], choices: ['帮媛夕把木箱送上月线', ...safeLocalChoices.slice(0, 2)] }),
            localSideTurn('问乘务员车上还有没有短工', '月线车厢', '乘务员核对车厢清单，确认车上没有新的紧急短工。种荚木箱已经固定；抵达下一站后，你仍可查看当地的普通工作、食物和休息处。', { characterIds: ['mira-voss'] }),
            localSideTurn('在下一站拿着钱币独自下车', '月线车厢', '你把手里的八枚钱币收好，告诉媛夕自己会在下一站独自下车。列车抵达银叶葡萄丘时，你踏上湿漉漉的月台，没有替自己增加新的约定。', { characterIds: ['mira-voss'], destination: '银叶葡萄丘', connectedTo: '月线车厢' }),
            localSideTurn('去亮着灯的田舍问过夜工作', '银叶葡萄丘', '田舍看守说明今晚不保证临时过夜工作，但指给你葡萄丘仍在招人的普通修补班。只有明确接下并完成工作后才会结算报酬。', { characterIds: ['mira-voss'] }),
            localSideTurn('喝完这一杯，明天独自旅行', '银叶葡萄丘', '你喝完杯里的淡酒，告诉媛夕明天会选择自己的路线。她接受这条边界；没有人替你收费，也没有增加新的承诺。', { characterIds: ['mira-voss'] }),
            localSideTurn('谢绝邀请，去田舍租一间房', '银叶葡萄丘', '你明确谢绝清晨调查，并向田舍看守支付十枚钱币租下今晚的房间。房门钥匙交到你手里，明早的路线仍由你自己决定。\n[widget: stat="coin" operation="remove" amount="10"]\n[clock: value="第二天 · 06:10"]\n[session_end: reason="你在银叶葡萄丘的田舍休息到清晨。"]', { characterIds: ['mira-voss'] }),
            {
              action: '沿葡萄行找还在剪枝的人',
              when: { locations: ['银叶葡萄丘'], characterIds: ['mira-voss'] },
              turn: { match: [], content: dynamicDebut.replace(/\[choices:[^\n]+\]\s*$/u, choicesCommand()) },
            },
            localSideTurn('收好钱币，做完就走', '灯湾码头', '你确认上一回合的收入已经记录，没有接下罗温后续的地图差事。路线箱重新扣紧，灯湾码头仍有短工、热饭和可以歇脚的地方。', { characterIds: ['rowan-hale'] }),
            localSideTurn('问罗温哪条夜班路线最缺人', '灯湾码头', '罗温核对招工牌，说明今晚各站的缺口会分别贴在本地告示上。询问不会替你接受工作，也不会提前获得报酬；当前码头仍有可当场确认的短工、热饭和休息处。', { characterIds: ['rowan-hale'] }),
            localSideTurn('留在灯湾继续找短工', '灯湾码头', '你告诉罗温这次不随地图上车，留在灯湾查看本地招工牌。他接受你的决定；新的工作只有在你明确接受并完成后才会结算。', { characterIds: ['rowan-hale'] }),
            localSideTurn('告诉罗温今晚只想找房间休息', '远灯研修院', '你把界限说清楚：今晚不再接新差事。罗温没有劝你改变主意，只指出客房、食堂和仍亮着灯的短工告示。询问房间不会替你付款或预订。', { characterIds: ['rowan-hale'] }),
            localSideTurn('自己参观还亮着灯的工坊', '远灯研修院', '你查看仍亮着灯的工坊。告示上是普通修理和清理工作；在你明确接受之前，没有任务或报酬被记到你名下。', { characterIds: ['rowan-hale'] }),
            localSideTurn('告诉罗温你今晚只想休息', '远灯研修院', '你把界限说清楚：今晚不再接新差事。罗温没有劝你改变主意，只指出客房、食堂和仍亮着灯的短工告示。询问房间不会替你付款或预订。', { characterIds: ['rowan-hale'] }),
            localSideTurn('收好钱币，离开舞台', '杯影夜市', '你确认上一回合的收入已经记录，和塞莱斯特说明这次搬运到此结束。你离开舞台边，杯影夜市的食摊、短工牌和长凳仍在营业。', { characterIds: ['celeste-ardin'] }),
            localSideTurn('问她演出为什么突然停了', '杯影夜市', '塞莱斯特检查潮湿的琴弦，告诉你雨水让音准失稳，必须等弦线干燥后才能继续。她没有要求你留下；夜市里仍有别的短工和休息处。', { characterIds: ['celeste-ardin'] }),
            localSideTurn('留在夜市找其他演出工作', '杯影夜市', '你留在杯影夜市询问下一场演出的临时工作。摊主把搬运、清场和布台三类告示指给你看，报酬都只在工作完成后结清。', { characterIds: ['celeste-ardin'] }),
            localSideTurn('到群岛后自己先找工作', '月线车厢', '你和塞莱斯特约好到站后各自行动。车门在潮汐群岛打开时，你先走向码头的短工告示，没有替自己预领任何报酬。', { characterIds: ['celeste-ardin'], destination: '潮汐群岛', connectedTo: '月线车厢' }),
            localSideTurn('去码头找修网的短工', '潮汐群岛', '你在潮汐群岛码头查看修网告示。工头说明这是普通短工，只有明确接下并完成后才结算；当前没有替你提前增加钱币。', { characterIds: ['celeste-ardin'] }),
            localSideTurn('独自沿退潮后的浅滩走走', '潮汐群岛', '你告诉塞莱斯特自己会沿退潮后的浅滩独自行走。她指出安全标记；你的行动留在眼前可见的海岸，没有凭空换到另一条路线。', { characterIds: ['celeste-ardin'] }),
            localSideTurn('演出后留在群岛接修网短工', '潮汐群岛', '你决定演出后留在群岛，先查看修网告示。只有明确接下并完成工作后才会结算，这一步没有替你接受班次或增加钱币。', { characterIds: ['celeste-ardin'] }),
            localSideTurn('听完清晨演出就和她告别', '潮汐群岛', '清晨演出结束后，你告诉塞莱斯特自己会继续独行。她接受这次告别；没有隐藏承诺，也没有把她加入同行队伍。', { characterIds: ['celeste-ardin'] }),
          ]
        : [
            localSideTurn('Take the short-job pay and stay at the quay', 'Lantern Quay', 'You carry the crate to the Moonline freight door and secure its straps without boarding. After checking the load, Mira pays you the agreed 8 coin. You pocket it and stay at Lantern Quay, where shift notices, hot food, and public benches remain available.\n[job: action="settle" id="mira-seed-crate"]', { characterIds: ['mira-voss'] }),
            localSideTurn('Ask Mira what the seeds are used for', 'Lantern Quay', 'Mira rests one seed case in her palm. It turns with moonlight, and she is taking this batch to Silverleaf Vineyard to compare the vines after rain. The crate still needs to reach the last Moonline.', { characterIds: ['mira-voss'], choices: ['Help Mira load the crate onto the Moonline', ...safeLocalChoices.slice(0, 2)] }),
            localSideTurn('Ask the steward whether the train needs more help', 'Moonline Carriage', 'The steward checks the carriage list and confirms that no urgent shift remains onboard. The seed crate is secured; you may look for ordinary work, food, or rest after arrival.', { characterIds: ['mira-voss'] }),
            localSideTurn('Take the coin and get off alone at the next stop', 'Moonline Carriage', 'You pocket the 8 coin in your hand and tell Mira you will leave the train alone. When the doors open at Silverleaf Vineyard, you step onto the wet platform without creating another obligation.', { characterIds: ['mira-voss'], destination: 'Silverleaf Vineyard', connectedTo: 'Moonline Carriage' }),
            localSideTurn('Ask for overnight work at the lit field house', 'Silverleaf Vineyard', 'The field-house keeper confirms that no overnight post is guaranteed, but points out ordinary repair shifts posted for the vineyard. Pay will be settled only after completed work.', { characterIds: ['mira-voss'] }),
            {
              action: 'Follow the sound of pruning shears into the vine rows',
              when: { locations: ['Silverleaf Vineyard'], characterIds: ['mira-voss'] },
              turn: { match: [], content: dynamicDebut.replace(/\[choices:[^\n]+\]\s*$/u, choicesCommand()) },
            },
            localSideTurn('Finish the cup and travel alone tomorrow', 'Silverleaf Vineyard', 'You finish the cup and tell Mira that tomorrow you will choose your own route. She accepts the boundary; nothing is charged or promised on your behalf.', { characterIds: ['mira-voss'] }),
            localSideTurn('Decline and rent a room at the field house', 'Silverleaf Vineyard', 'You explicitly decline the dawn survey and pay 10 coin to the field-house keeper for tonight\'s room. The key is placed in your hand, and tomorrow\'s route remains your decision.\n[widget: stat="coin" operation="remove" amount="10"]\n[clock: value="Day 2 · 06:10"]\n[session_end: reason="You rest in the Silverleaf field house until morning."]', { characterIds: ['mira-voss'] }),
            localSideTurn('Pocket the coin and leave after the shift', 'Lantern Quay', 'You put away the pay already settled and decline Rowan’s next map errand. The route case closes, and the quay’s ordinary work, food, and rest remain available.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Ask Rowan which night route needs workers', 'Lantern Quay', 'Rowan checks the board and explains that tonight’s openings are posted separately at each stop. No job is accepted and no pay is granted until you choose and complete one.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Stay in Lantern Quay and find more work', 'Lantern Quay', 'You stay at Lantern Quay and read the current shift board. Hauling and sorting are available, with pay due only after the work is completed.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Rest against the carriage window', 'Moonline Carriage', 'You rest against the warm carriage window until your shoulders loosen. The train continues along its confirmed route while ordinary choices remain open.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Get off first when the train arrives', 'Moonline Carriage', 'You tell Rowan you will step off first. When the train reaches Far Lantern Institute, you leave the carriage and wait beneath the workshop lamps.', { characterIds: ['rowan-hale'], destination: 'Far Lantern Institute', connectedTo: 'Moonline Carriage' }),
            localSideTurn('Visit the workshops that are still open', 'Far Lantern Institute', 'You check the workshops that still have lamps on. The posted work is ordinary repair and cleanup; no task or pay is assigned until you accept one.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Tell Rowan you only need a room tonight', 'Far Lantern Institute', 'You tell Rowan that lodging, not another route, is your priority. He points out the canteen, the guest rooms, and the public rest area without making a decision for you.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Take the pay and choose your own route', 'Far Lantern Institute', 'You keep the pay already settled and tell Rowan you will choose your own route. He accepts the decision, and the institute’s ordinary options remain open.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Tell Rowan you only want to rest tonight', 'Far Lantern Institute', 'You tell Rowan that you will not take another assignment tonight. He respects the boundary and points out food, benches, and the remaining public notices.', { characterIds: ['rowan-hale'] }),
            localSideTurn('Pocket the coin and leave the stage', 'Cupshadow Market', 'You keep the pay already settled and confirm that the stage job is finished. Celeste accepts the goodbye; the market’s food, benches, and other shifts remain open.', { characterIds: ['celeste-ardin'] }),
            localSideTurn('Ask why the performance stopped', 'Cupshadow Market', 'Celeste checks the damp strings and explains that rain pulled the instrument out of tune. She must let it dry before playing again, and does not require you to wait.', { characterIds: ['celeste-ardin'] }),
            localSideTurn('Stay at the market and find other stage work', 'Cupshadow Market', 'You remain at Cupshadow Market and inspect the next stage notices. Hauling, cleanup, and setup are listed, with pay due only after completed work.', { characterIds: ['celeste-ardin'] }),
            localSideTurn('Ask what the dawn job on the islands pays', 'Cupshadow Market', 'Celeste explains that the island organizer settles pay after setup is finished. Asking does not accept the job or credit any coin.', { characterIds: ['celeste-ardin'] }),
            localSideTurn('Look for your own work after reaching the islands', 'Moonline Carriage', 'You and Celeste agree to separate after arrival. When the doors open at the Tidal Islands, you head first toward the landing’s public work board.', { characterIds: ['celeste-ardin'], destination: 'Tidal Islands', connectedTo: 'Moonline Carriage' }),
            localSideTurn('Take a net-mending job at the landing', 'Tidal Islands', 'You ask about the net-mending shift at the landing. The foreman confirms that it is ordinary paid work and will settle only after completion.', { characterIds: ['celeste-ardin'] }),
            localSideTurn('Walk the exposed tide flats alone', 'Tidal Islands', 'You tell Celeste you will walk the exposed tide flats alone. She points out the safe markers, and you keep the choice within the visible shore instead of inventing a new route.', { characterIds: ['celeste-ardin'] }),
            localSideTurn('Stay on the islands for net-mending work', 'Tidal Islands', 'You decide to remain on the islands and inspect the net-mending board. No shift or payment is committed until you take and finish the work.', { characterIds: ['celeste-ardin'] }),
            localSideTurn('Say goodbye after the dawn concert', 'Tidal Islands', 'After the dawn concert, you tell Celeste that you will continue alone. She accepts the goodbye; no hidden promise or party change is added.', { characterIds: ['celeste-ardin'] }),
          ]
    ),
  )

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
    presetEventDirector: { events: wanderlightPresetEvents(locale) },
    director: { mode: 'open-world', fixedWorldRules: [s('所有可亲密角色明确为 24 岁以上成年人。', 'Every intimate character is explicitly aged 24 or older.'), s('人物只知道亲历或被告知的事实，约定与边界持续存在。', 'Characters know only witnessed or told facts; promises and boundaries persist.'), s('长期角色使用稳定 id，固化身份不能静默替换。', 'Recurring characters use stable ids and anchored identities cannot be silently replaced.'), s('跨地区移动先经过月线车厢或月台。', 'Cross-region travel passes through the Moonline carriage or platform.'), s('关系变化引用可见事件，不使用隐藏好感值。', 'Relationship changes cite visible events, not a hidden affection score.'), ...expansionDirector.fixedRules], generationRules: [s('可创造符合当前地区的成年 NPC、工作和邀请。', 'You may create adult NPCs, jobs and invitations appropriate to the region.'), s('新 NPC 正式登场时使用稳定 id 和英文视觉身份字段。', 'A new NPC formal debut uses a stable id and English visual identity fields.'), s('暧昧来自共同活动、同意和边界，不描写露骨性行为。', 'Flirtation grows from shared activity, consent and boundaries, never explicit sex.'), s('每回合改变一项权威事实。', 'Every turn changes one authoritative fact.'), s('叙事先写清人物、动作与因果；质感来自可见细节和潜台词，不使用晦涩隐喻或幕后术语。', 'Narration makes actors, actions, and causality clear; texture comes from observable detail and subtext, never obscure metaphor or design jargon.'), s('每次最多引入一个陌生世界词，并立刻通过外形、用途或现场反应自然说明。', 'Introduce at most one unfamiliar world term at a time and explain it immediately through appearance, function, or an observable reaction.'), ...expansionDirector.generationRules], choiceIntents: [s('跟随某人或加深关系', 'follow someone or deepen a relationship'), s('探索地点或接受工作', 'explore a place or accept work'), s('保护时间、资源或边界', 'protect time, resources or a boundary')], maxActiveThreads: 3 },
    dangerDirector: { minSafeTurns: 3, maxSafeTurns: 5, cooldownTurns: 3, escalationStats: ['energy', 'coin', 'renown'], threatPalette: dangerThreats, threatLocations, methods: [s('先问清楚发生了什么', 'Ask what happened first'), s('冒险继续原来的计划', 'Risk carrying on with the plan'), s('先退一步，换个办法', 'Step back and try another way')], legacyMethods: [['询问并理解警告', '承担代价保护承诺', '撤退、改道或设定边界'], ['ask for context', 'protect a promise at a cost', 'withdraw, reroute or set a boundary']], physicalCombat: 'none', resolution: { skill: s('判断', 'Judgment'), modifier: 2, dcBySeverity: [7, 9, 11, 13, 15], fallbackCosts: [{ statId: 'energy', operation: 'remove', amount: 12 }] } },
    initialFacts: { all_intimate_characters_adult: true, dynamic_identity_trial: true, world_expansion_v2: true, moonline_stamps_used: 0, world_day: 1, jobs_completed: 0, meals_eaten: 0, nights_slept: 0, carriage_rests: 0, exhaustion_recoveries: 0 },
    statDefinitions: [
      {
        id: 'energy', label: s('精力', 'Energy'), min: 0, max: 100, initial: 72, display: 'bar', inverse: true, warningAt: 28, dangerAt: 8, maxDelta: 24, domainMaxDelta: 36,
        description: s('代表还能承受多少工作、赶路和危险。任何时候都能主动休息；普通休息 +8、公共休息处 +16、热饭 +12、客房 +28、休息到清晨 +36。低于 28 会疲惫，短工低于 12 无法进行；归零后必须先恢复。危险未解除时只能先应对或撤退。', 'How much work, travel, and danger you can still bear. You may rest at any time: ordinary rest +8, public rest area +16, hot meal +12, room +28, rest until morning +36. Below 28 signals fatigue; shifts require 12; at zero you must recover first. During active danger, respond or withdraw before resting.'),
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
    deterministicChoiceTurns,
    demoTurns: [
      miraOpeningTurn,
      { match: zh ? ['送上月线', '月线'] : ['Moonline', 'load'], content: transit, imagePrompt: 'inside a warm Moonline carriage leaving Lantern Quay, rain-bright city lights outside, one secured seed crate and two separate seats, environmental transition with people only as small silhouettes, no text, no UI, 4:3', imageSubject: 'environment' },
      { match: zh ? ['葡萄丘', '陪媛夕'] : ['Silverleaf', 'ride with Mira'], content: reunion, imagePrompt: 'Silverleaf Vineyard after rain, medium shot of one adult botanist waiting beside two stools between moon-turning vines, same short asymmetrical deep-brown bob, narrow copper hairpin above right ear, sage jacket and copper pendant, player off-camera, no text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'mira-voss' },
      { match: zh ? ['剪枝', '葡萄行', '找'] : ['pruning shears', 'vine rows', 'follow'], content: dynamicDebut, imagePrompt: 'Silverleaf Vineyard at night, formal first identity anchor of one adult trellis repairer beside a rain-bent vine, jaw-length deep-golden curls, narrow brass leaf clip at left temple, stone-blue cape, no other readable face, no text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'talin-rey' },
      ...v1Turns,
      ...v1Outcomes,
      ...expansionTurns.demo,
    ],
  }
}

export const wanderlight = make('zh')
export const wanderlightEn = make('en')
