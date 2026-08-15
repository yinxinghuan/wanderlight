import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { buildDangerDirective, repairLegacyDangerMethodChoices } from '../src/story/engine/dangerDirector'
import { applyParsedScene, createChoiceRecordBlock, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'

const initial = createInitialSave(wanderlight)
const destinations = ['lantern-quay', 'silverleaf-vineyard', 'far-lantern-institute', 'tidal-islands']
const threats = destinations.map((nodeId) => {
  const node = initial.map.find((entry) => entry.id === nodeId)!
  const save = {
    ...initial,
    scene: 8,
    location: node.label,
    map: initial.map.map((entry) => ({ ...entry, current: entry.id === nodeId, visited: entry.visited || entry.id === nodeId })),
    danger: { ...initial.danger, safeTurns: 99 },
  }
  const directive = buildDangerDirective(save, wanderlight, `inspect-${nodeId}`)
  assert.equal(directive?.phase, 'warning')
  return directive!.threat
})

assert.ok(new Set(threats).size >= 2, 'different route locations must not all open with the same deterministic threat')

const warningSave = {
  ...initial,
  scene: 8,
  danger: { ...initial.danger, phase: 'warning' as const, currentThreat: '已建立的本地威胁', safeTurns: 0 },
}
assert.equal(buildDangerDirective(warningSave, wanderlight, '继续处理')?.threat, '已建立的本地威胁', 'an active threat remains stable until resolution')

const checkpoint = { ...initial, scene: 8, sessionEnded: true, choices: [], danger: { ...initial.danger, safeTurns: 99 } }
const warning = buildDangerDirective(checkpoint, wanderlight, '继续漫游')!
const replylessWarning = applyParsedScene(checkpoint, parseStoryProtocol(`公告板上出现了末班月线取消的警告。
[scene_location: location="灯湾码头"]
[encounter: phase="warning" kind="${warning.threat}" severity="${warning.severity}" outcome="active"]`, 'zh'), wanderlight, '继续漫游', undefined, undefined, warning)
assert.deepEqual(replylessWarning.choices.map((choice) => choice.label), [...warning.methods], 'a replyless danger turn uses configured response methods instead of generic recovery choices')
assert.equal(replylessWarning.choices.some((choice) => choice.label.includes('追查“')), false)

assert.deepEqual(wanderlight.dangerDirector?.methods, [
  '先问清楚发生了什么',
  '冒险继续原来的计划',
  '先退一步，换个办法',
], '固定危险选项必须是玩家能直接理解的行动')

const legacyMethods = ['询问并理解警告', '承担代价保护承诺', '撤退、改道或设定边界']
const legacySave = {
  ...initial,
  scene: 12,
  facts: { ...initial.facts },
  choices: legacyMethods.map((label, index) => ({ id: `legacy-danger-${index}`, label })),
  blocks: [...initial.blocks, createChoiceRecordBlock(12, legacyMethods.map((label, index) => ({ id: `legacy-danger-${index}`, label })))],
}
const migrated = repairLegacyDangerMethodChoices(legacySave, wanderlight)
assert.deepEqual(migrated.choices.map((choice) => choice.label), wanderlight.dangerDirector?.methods, '旧存档的当前危险选项必须换成新文案')
assert.deepEqual(JSON.parse(migrated.blocks.find((block) => block.id === 'choices-12')!.text), wanderlight.dangerDirector?.methods, '正文中的当前选项记录必须同步迁移')
assert.equal(migrated.facts['legacy-danger-method-copy-repaired-v1'], true)
assert.deepEqual(repairLegacyDangerMethodChoices(legacySave, wanderlightEn).choices.map((choice) => choice.label), wanderlightEn.dangerDirector?.methods, '切换语言时也必须把另一种语言的旧文案迁移到当前语言')

console.log(JSON.stringify({ ok: true, checks: ['location-varied-threat-selection', 'active-threat-stability', 'replyless-danger-methods', 'plain-language-methods', 'legacy-method-copy-migration'] }))
