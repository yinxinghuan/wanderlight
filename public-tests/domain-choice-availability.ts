import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { repairDomainRepeatState, repairEndedSessionChoices, resolveDomainAction } from '../src/story/engine/domainRules'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import type { StorySave } from '../src/story/types'

function act(save: StorySave, action: string): StorySave {
  const resolution = resolveDomainAction(save, wanderlight, action)
  assert.ok(resolution, `missing domain resolution for ${action}`)
  const parsed = parseStoryProtocol(resolution.successText, 'zh')
  return applyParsedScene(save, parsed, wanderlight, action, undefined, undefined, undefined, resolution)
}

let save = createInitialSave(wanderlight)
const ambiguousSpend = resolveDomainAction(save, wanderlight, '把钱全部花完')
assert.equal(ambiguousSpend?.ruleId, 'clarify-spending-target')
const afterAmbiguousSpend = act(save, '把钱全部花完')
assert.equal(afterAmbiguousSpend.stats.coin, save.stats.coin, '未说明购买对象时余额必须保持不变')
assert.equal(afterAmbiguousSpend.blocks.filter((block) => block.text === ambiguousSpend?.successText).length, 1, '本地领域结果只显示一次')
assert.deepEqual(afterAmbiguousSpend.choices.map((choice) => choice.label), save.choices.map((choice) => choice.label), '澄清回合必须保留原剧情选项而不是换成通用菜单')
assert.equal(resolveDomainAction(save, wanderlight, '把钱全部花完买一顿热饭')?.ruleId, 'hot-meal', '带具体对象的消费不能被精确澄清规则截获')
save = act(save, '找一份短工')
assert.equal(save.objective, '房钱已经足够；决定今晚住下、继续工作，还是搭月线离开。', '收入达到房费后旧目标必须立即推进')
assert.equal(save.stats.energy, 62, '短工只扣除一次十点精力')
assert.equal(save.stats.coin, 15, '短工只结算一次九枚钱币')
assert.equal(save.stats.renown, 6, '短工只增加一次两点风闻')
const latestAction = save.blocks.findIndex((block) => block.id === 'action-1')
const actionTail = save.blocks.slice(latestAction + 1)
assert.equal(actionTail[0]?.kind, 'narration', '本地行动的可见结果必须先于数值条出现')
assert.match(actionTail[0]?.text ?? '', /九枚钱币/, '短工反馈必须说明具体工作和报酬')
assert.equal(save.choices.some((choice) => /九十分钟短工|找一份短工/.test(choice.label)), false, '同地点同一天完成后不能再次显示同一即时短工')
const repeated = resolveDomainAction(save, wanderlight, '找一份短工')
assert.equal(repeated?.status, 'rejected', '强行重复提交同地点同一天的短工也必须被拒绝')
assert.match(repeated?.reasons.join('') ?? '', /今天.*已经做完/, '重复提交必须给出具体原因')
const beforeRepeat = { ...save.stats }
const imagesBeforeRepeat = save.blocks.filter((block) => block.kind === 'image').length
save = act(save, '找一份短工')
assert.deepEqual(save.stats, beforeRepeat, '重复短工不能再次扣体力、发钱或增加风闻')
assert.equal(save.blocks.filter((block) => block.kind === 'image').length, imagesBeforeRepeat, '被拒绝的重复行动不能生成一张没有新事件的场景图')
assert.equal(save.blocks.find((block) => block.data?.domainStatus === 'rejected')?.kind, 'narration', '拒绝原因必须使用正文可读字号，而不是弱系统行')
assert.deepEqual(save.choices.map((choice) => choice.label), createInitialSave(wanderlight).choices.map((choice) => choice.label), '被拒绝的重复短工必须继续保留原剧情线程')
assert.equal(save.choices.some((choice) => /九十分钟短工|热饭|四十五分钟/.test(choice.label)), false, '领域动作不能再注入固定工具菜单')

save = act(save, '结束今天，休息到清晨')
assert.equal(save.facts.world_day, 2, '休息到清晨必须进入第二天')
assert.equal(save.sessionEnded, true, '休息到清晨必须进入明确的日终停点')
assert.equal(save.choices.length, 0, '日终停点不能继续显示吃饭、休息、短工或再次结束当天的普通选项')
assert.equal(resolveDomainAction(save, wanderlight, '找一份短工')?.status, 'accepted', '进入第二天后短工冷却已解除，但必须等玩家继续漫游后才重新进入选择界面')

const lowEnergy = {
  ...createInitialSave(wanderlight),
  stats: { ...createInitialSave(wanderlight).stats, energy: 2 },
}
const lowEnergyShift = resolveDomainAction(lowEnergy, wanderlight, '接一份九十分钟短工（报酬 9 枚）')
assert.equal(lowEnergyShift?.status, 'rejected', '体力不足时短工必须在执行前拒绝')

const legacyAfterShift = {
  ...createInitialSave(wanderlight),
  scene: 1,
  time: '第 2 天 · 21:55',
  facts: { world_day: 2 },
  blocks: [
    ...createInitialSave(wanderlight).blocks,
    { id: 'action-1', kind: 'event' as const, text: '找一份短工' },
    { id: 'domain-1', kind: 'event' as const, text: '旧版短工已经完成', data: { domainRule: 'local-shift', domainStatus: 'accepted' } },
  ],
}
const migratedLegacy = repairDomainRepeatState(legacyAfterShift, wanderlight)
assert.equal(resolveDomainAction(migratedLegacy, wanderlight, '找一份短工')?.status, 'rejected', '旧存档最新回合已完成短工时必须迁移冷却，不能更新后再扣一次')

const legacyEnded = repairEndedSessionChoices({
  ...createInitialSave(wanderlight),
  scene: 4,
  sessionEnded: true,
  choices: [
    { id: 'legacy-meal', label: '吃一顿热饭' },
    { id: 'legacy-rest', label: '原地坐下，休息四十五分钟' },
    { id: 'legacy-retreat', label: '放弃当前行动，去最近的公共休息处' },
    { id: 'legacy-end-day', label: '结束今天，休息到清晨' },
  ],
  blocks: [
    ...createInitialSave(wanderlight).blocks,
    { id: 'choices-4', kind: 'choices' as const, text: 'legacy ordinary choices' },
  ],
})
assert.equal(legacyEnded.choices.length, 0, '上一版已经保存的日终四选项必须在载入时清空')
assert.equal(legacyEnded.blocks.some((block) => block.id === 'choices-4'), false, '旧日终选项的正文记录也必须移除')
assert.equal(legacyEnded.facts['legacy-day-end-choices-repaired-v1'], true, '旧存档迁移必须留下可诊断标记')

const movedAfterShift = {
  ...migratedLegacy,
  location: '杯影夜市',
  sceneLocation: '杯影夜市',
  map: migratedLegacy.map.map((node) => ({ ...node, current: node.id === 'cupshadow-market', visited: node.visited || node.id === 'cupshadow-market' })),
}
assert.equal(resolveDomainAction(movedAfterShift, wanderlight, '找一份短工')?.status, 'accepted', '移动到新地点后可以找到该地点当天的新短工')

const english = createInitialSave(wanderlightEn)
const englishFirst = resolveDomainAction(english, wanderlightEn, 'Take a ninety-minute shift (9 coin)')
assert.equal(englishFirst?.status, 'accepted', 'English short-job label must resolve')
const englishAfter = applyParsedScene(english, parseStoryProtocol(englishFirst!.successText, 'en'), wanderlightEn, 'Take a ninety-minute shift (9 coin)', undefined, undefined, undefined, englishFirst)
assert.equal(resolveDomainAction(englishAfter, wanderlightEn, 'Look for a short job')?.status, 'rejected', 'English repeat must be blocked in the same place and day')
assert.equal(resolveDomainAction(englishAfter, wanderlightEn, 'Look for another short job')?.status, 'rejected', 'English free-input repeat wording must hit the same atomic repeat gate')
assert.equal(resolveDomainAction(english, wanderlightEn, 'Pay for the room and stay overnight')?.status, 'rejected', 'English overnight wording must resolve through lodging preflight instead of falling through to the model')
for (const phrase of ['Stay overnight', 'Stay the night', 'Book the room', 'Rent the room', 'Get a room for the night']) {
  assert.ok(resolveDomainAction(english, wanderlightEn, phrase), `English lodging commitment must reach deterministic preflight: ${phrase}`)
}
for (const phrase of ['Find another shift', 'Take another shift', 'Do another short job']) {
  assert.equal(resolveDomainAction(englishAfter, wanderlightEn, phrase)?.status, 'rejected', `English repeated work variant must hit the repeat gate: ${phrase}`)
}
for (const phrase of ['Can I rest here?', 'May I rest here?', 'Is resting allowed here?', 'Can I stay overnight?']) {
  assert.equal(resolveDomainAction(english, wanderlightEn, phrase), undefined, `English rest inquiry must not execute recovery or lodging: ${phrase}`)
}
for (const phrase of ['我可以在这里休息吗？', '这里可以休息吗？', '我能在这里睡一会吗？', '可以住一晚吗？']) {
  assert.equal(resolveDomainAction(createInitialSave(wanderlight), wanderlight, phrase), undefined, `中文休息询问不能执行恢复或住宿: ${phrase}`)
}

const poor = { ...createInitialSave(wanderlight), stats: { ...createInitialSave(wanderlight).stats, coin: 2 } }
const rejectedRoom = resolveDomainAction(poor, wanderlight, '住一晚')
assert.equal(rejectedRoom?.status, 'rejected')
assert.ok(rejectedRoom?.reasons.some((reason) => reason.includes('十枚钱币')))

const poorPayment = resolveDomainAction(poor, wanderlight, '支付房费')
assert.equal(poorPayment?.status, 'rejected', '自然语言付款也必须先经过房费余额检查')
assert.equal(resolveDomainAction(poor, wanderlight, '询问旅店房费'), undefined, '询问价格不是订房或付款')

const funded = { ...createInitialSave(wanderlight), stats: { ...createInitialSave(wanderlight).stats, coin: 12 } }
const afterRoom = act(funded, '订一间房')
assert.equal(afterRoom.stats.coin, 2, '明确订房后由领域 reducer 原子扣除十枚钱币')
assert.equal(afterRoom.facts.lodging_secured, true, '付款成功必须持久化已获得住宿')
assert.equal(afterRoom.sessionEnded, true, '过夜住宿应进入已保存的自然停止点')

console.log(JSON.stringify({ ok: true, checks: ['single-shift-per-location-day', 'visible-result-before-deltas', 'forced-repeat-zero-effects', 'resume-original-thread', 'day-end-zero-ordinary-choices', 'legacy-day-end-choice-migration', 'next-day-cooldown-cleared', 'new-location-reopens', 'legacy-repeat-migration', 'low-energy-preflight', 'zh-en-repeat-policy', 'free-input-specific-reason', 'lodging-payment-preflight', 'lodging-atomic-state'] }))
