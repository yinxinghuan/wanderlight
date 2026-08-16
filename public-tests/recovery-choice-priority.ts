import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { encodeChoiceRecord } from '../src/story/engine/choiceInput'
import { createInitialSave, createRecoveryChoices, repairLegacyObjectiveRecoveryChoices } from '../src/story/engine/reducer'

const zh = createInitialSave(wanderlight)
zh.scene = 45
zh.location = '银叶葡萄丘'
zh.objective = '寻找替代调查方案。'
const zhChoices = createRecoveryChoices(zh, wanderlight)
assert.deepEqual(zhChoices.map((choice) => choice.label), ['寻找替代调查方案'], '明确持续事项存在时只保留该事项，不混入观察或泛化商量')
assert.equal(zhChoices.some((choice) => choice.label.includes('追查“')), false, '不得再给持续事项套“追查线索”话术')

const en = createInitialSave(wanderlightEn)
en.scene = 45
en.location = 'Silverleaf Vineyard'
en.objective = 'Find an alternate survey plan.'
assert.deepEqual(createRecoveryChoices(en, wanderlightEn).map((choice) => choice.label), ['Find an alternate survey plan'], 'English objective is also the sole direct recovery action')

const noObjective = { ...zh, objective: '' }
const idleChoices = createRecoveryChoices(noObjective, wanderlight)
assert.equal(idleChoices.length, 1, '没有持续事项时提供一个具体地区事件入口')
assert.ok(wanderlight.presetEventDirector?.events.some((event) => event.locationId === 'silverleaf-vineyard' && event.choiceLabel === idleChoices[0]?.label), '空闲兜底必须来自当前地区预设事件池')
assert.equal(/观察银叶葡萄丘的新变化/.test(idleChoices[0]?.label ?? ''), false, '有具体事件时不显示泛化观察文案')

const legacyChoices = [
  { id: 'legacy-observe', label: '观察银叶葡萄丘的新变化' },
  { id: 'legacy-objective', label: '追查“寻找替代调查方案”的线索' },
]
const legacy = {
  ...zh,
  choices: legacyChoices,
  blocks: [...zh.blocks, { id: 'choices-45', kind: 'choices' as const, text: encodeChoiceRecord(legacyChoices), data: { scene: 45 } }],
}
const migrated = repairLegacyObjectiveRecoveryChoices(legacy, wanderlight)
assert.deepEqual(migrated.choices.map((choice) => choice.label), ['寻找替代调查方案'], '旧存档加载后立即移除会打断持续事项的泛化按钮')
assert.equal(migrated.blocks.find((block) => block.id === 'choices-45')?.text, encodeChoiceRecord(migrated.choices), '旧存档不可变选项记录同步修复')
assert.deepEqual(repairLegacyObjectiveRecoveryChoices(migrated, wanderlight), migrated, '迁移必须幂等')

const latestGenericSet = {
  ...zh,
  choices: [
    { id: 'objective', label: '寻找替代调查方案' },
    { id: 'observe', label: '观察银叶葡萄丘的新变化' },
    { id: 'discuss', label: '和同行者商量下一步' },
  ],
}
assert.deepEqual(repairLegacyObjectiveRecoveryChoices(latestGenericSet, wanderlight).choices.map((choice) => choice.label), ['寻找替代调查方案'], '上一版目标+观察+商量的存档也必须收敛到未完事项')

console.log(JSON.stringify({ ok: true, checks: ['ongoing-objective-only', 'observation-fallback', 'danger-fallback', 'no-abstract-wrapper', 'legacy-record-migration', 'zh-en'] }))
