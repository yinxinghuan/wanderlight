import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { encodeChoiceRecord } from '../src/story/engine/choiceInput'
import { createInitialSave, createRecoveryChoices, repairLegacyObjectiveRecoveryChoices } from '../src/story/engine/reducer'

const zh = createInitialSave(wanderlight)
zh.scene = 45
zh.location = '银叶葡萄丘'
zh.objective = '寻找替代调查方案。'
const zhChoices = createRecoveryChoices(zh, wanderlight)
assert.deepEqual(zhChoices.map((choice) => choice.label), ['寻找替代调查方案', '观察银叶葡萄丘的新变化'], '明确持续事项必须原文优先，观察只作兜底')
assert.equal(zhChoices.some((choice) => choice.label.includes('追查“')), false, '不得再给持续事项套“追查线索”话术')

const en = createInitialSave(wanderlightEn)
en.scene = 45
en.location = 'Silverleaf Vineyard'
en.objective = 'Find an alternate survey plan.'
assert.deepEqual(createRecoveryChoices(en, wanderlightEn).map((choice) => choice.label), ['Find an alternate survey plan', 'Observe what changed around Silverleaf Vineyard'], 'English objective is also the direct primary action')

const noObjective = { ...zh, objective: '' }
assert.deepEqual(createRecoveryChoices(noObjective, wanderlight).map((choice) => choice.label), ['观察银叶葡萄丘的新变化'], '没有持续事项时保留观察变化兜底')

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
assert.deepEqual(migrated.choices.map((choice) => choice.label), ['寻找替代调查方案', '观察银叶葡萄丘的新变化'], '旧存档加载后立即改为持续事项优先')
assert.equal(migrated.blocks.find((block) => block.id === 'choices-45')?.text, encodeChoiceRecord(migrated.choices), '旧存档不可变选项记录同步修复')
assert.deepEqual(repairLegacyObjectiveRecoveryChoices(migrated, wanderlight), migrated, '迁移必须幂等')

console.log(JSON.stringify({ ok: true, checks: ['ongoing-objective-first', 'observation-fallback', 'no-abstract-wrapper', 'legacy-record-migration', 'zh-en'] }))
