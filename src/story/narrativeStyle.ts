import type { Locale } from './types'

export function narrativeStyleContract(locale: Locale): string {
  return locale === 'zh'
    ? `叙事语言合同（强制）：清楚是底线，质感来自具体细节和潜台词，不来自晦涩。
- 先写谁做了什么、玩家看见或听见什么、这件事为什么与当前行动有关；关键因果必须一遍读懂。
- 每个短段只推进一个主要事实。句子以常用词和具体动词为主，不堆叠抽象名词、诗性判断、设计术语或世界观说明。
- 每次最多引入一个陌生世界词；第一次出现时，在同一句或紧接的一句用外形、用途或现场反应自然解释。不要要求玩家查词或猜隐喻。
- 气氛写进灯光、声音、天气、距离、停顿、手势和物件。不要用“命运、承诺、羁绊、回响、某种感觉”等抽象词替代实际发生的事。
- 对话要像真实成年人在当前处境中说话：有所保留、有潜台词，但意思可判断；人物不替作者讲设定。
- 选项使用直接动词，只承接正文已经出现的人、地点、物品和问题。不要写“探索可能性”“回应命运”一类空泛行动。
- 不要解释叙事设计，不要出现“中转锚点、视觉身份、关系升温、剧情节点、世界规则”等幕后词。
- 可以保留一句有余味的表达，但它不能承担行动所需的关键信息；删掉它以后，玩家仍应知道发生了什么和能做什么。`
    : `NARRATIVE LANGUAGE CONTRACT (mandatory): clarity is the floor; quality comes from concrete detail and subtext, never obscurity.
- First establish who did what, what the player can see or hear, and why it matters to the immediate action. Essential cause and effect must be clear on one reading.
- Give each short paragraph one main new fact. Prefer familiar words and concrete verbs; do not stack abstractions, poetic judgments, design jargon, or lore exposition.
- Introduce at most one unfamiliar world term at a time. On first use, explain it naturally in the same or next sentence through appearance, function, or an observable reaction. Never make the player decode a metaphor to act.
- Put atmosphere in light, sound, weather, distance, pauses, gestures, and objects. Do not use fate, promises, bonds, echoes, or vague feelings as substitutes for events.
- Dialogue should sound like real adults in the present situation: restrained and capable of subtext, but with an intelligible intent. Characters do not lecture the setting.
- Choices begin with direct verbs and refer only to people, places, objects, or problems already visible. Never offer vague actions such as “embrace possibility” or “answer destiny.”
- Never expose design language such as transition anchor, visual identity, relationship warming, story node, or world rule.
- One resonant line is welcome, but it must not carry information needed to choose. If removed, the player must still know what happened and what they can do.`
}
