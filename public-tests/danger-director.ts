import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { buildDangerDirective, contextualDangerChoiceLabels, repairLegacyDangerMethodChoices } from '../src/story/engine/dangerDirector'
import { resolveDomainAction } from '../src/story/engine/domainRules'
import { applyParsedScene, createChoiceRecordBlock, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'

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

let scopedThreatRuns = 0
for (const cartridge of [wanderlight, wanderlightEn]) {
  const scopedInitial = createInitialSave(cartridge)
  for (const node of cartridge.initialMap) {
    for (let cycle = 0; cycle < 24; cycle += 1) {
      const save = {
        ...scopedInitial,
        scene: 20 + cycle,
        location: node.label,
        map: scopedInitial.map.map((entry) => ({ ...entry, current: entry.id === node.id, visited: entry.visited || entry.id === node.id })),
        danger: { ...scopedInitial.danger, safeTurns: 99, cycle },
      }
      const directive = buildDangerDirective(save, cartridge, `scope-${node.id}-${cycle}`)!
      const allowed = cartridge.dangerDirector?.threatLocations?.[directive.threat]
      assert.ok(!allowed?.length || allowed.includes(node.id), `${directive.threat} cannot be scheduled at ${node.label}`)
      scopedThreatRuns += 1
    }
  }
}

const whitecapNode = initial.map.find((node) => node.id === 'whitecap-baths')!
const whitecapSave = {
  ...initial,
  scene: 20,
  location: whitecapNode.label,
  sceneLocation: '白浪浴镇·洗衣房',
  choices: [{ id: 'repair-belt', label: '检查皮带张力' }, { id: 'repair-leak', label: '拧紧漏水接头' }],
  map: initial.map.map((node) => ({ ...node, current: node.id === whitecapNode.id, visited: node.visited || node.id === whitecapNode.id })),
  danger: { ...initial.danger, safeTurns: 99, cycle: 0 },
}
const whitecapDirective = buildDangerDirective(whitecapSave, wanderlight, '检查皮带张力')!
assert.notEqual(whitecapDirective.threat, '银雨封闭葡萄丘道路', 'a vineyard-only road closure cannot be selected in the Whitecap washhouse')

const mismatchedWashhouse = parseStoryProtocol(`你和媛夕留在洗衣房检查传动皮带与漏水接头。工人把扳手和润滑油递给你们。
[scene_location: location="白浪浴镇·洗衣房"]
[choices: "继续检查传动皮带"|"先修漏水接头"]`, 'zh')
const rejectedScheduledThreat = prepareTurnCandidate({
  save: whitecapSave,
  cartridge: wanderlight,
  action: '检查皮带张力',
  parsed: mismatchedWashhouse,
  dangerDirective: whitecapDirective,
})
assert.ok(rejectedScheduledThreat.violations.includes('turn.scheduled_threat_requires_visible_establishment'))
assert.ok(rejectedScheduledThreat.violations.includes('turn.scheduled_threat_choices_must_address_threat'))
assert.equal(rejectedScheduledThreat.canCommitWithoutReplies, false, 'an invisible scheduled threat must be repaired instead of committed as a replyless safe turn')

const reducerDefense = applyParsedScene(
  whitecapSave,
  mismatchedWashhouse,
  wanderlight,
  '检查皮带张力',
  undefined,
  undefined,
  whitecapDirective,
)
assert.equal(reducerDefense.danger.phase, 'calm', 'a hidden or mismatched directive cannot enter authoritative state')
assert.ok(reducerDefense.choices.every((choice) => !choice.label.includes(whitecapDirective.threat)), 'a hidden directive cannot replace current replies with unrelated threat choices')

const establishedWashhouse = parseStoryProtocol(`洗衣房的工人刚拧紧接头，${whitecapDirective.threat}的消息就从门外传来。这个变化会直接影响你们眼前的工作。
[scene_location: location="白浪浴镇·洗衣房"]
[encounter: phase="warning" kind="${whitecapDirective.threat}" severity="${whitecapDirective.severity}" outcome="active"]
[choices: "先查清${whitecapDirective.threat}的具体影响"|"暂停工作，应对${whitecapDirective.threat}"]`, 'zh')
const acceptedScheduledThreat = prepareTurnCandidate({
  save: whitecapSave,
  cartridge: wanderlight,
  action: '检查皮带张力',
  parsed: establishedWashhouse,
  dangerDirective: whitecapDirective,
})
assert.equal(acceptedScheduledThreat.violations.some((violation) => violation.startsWith('turn.scheduled_threat')), false)
const committedScheduledThreat = applyParsedScene(whitecapSave, acceptedScheduledThreat.parsed, wanderlight, '检查皮带张力', undefined, undefined, whitecapDirective)
assert.equal(committedScheduledThreat.danger.phase, 'warning')
assert.equal(committedScheduledThreat.danger.currentThreat, whitecapDirective.threat)
assert.ok(committedScheduledThreat.choices.every((choice) => choice.label.includes(whitecapDirective.threat)))

const dangerBlockedShift = resolveDomainAction(
  { ...whitecapSave, danger: { ...whitecapSave.danger, phase: 'warning' as const, currentThreat: whitecapDirective.threat } },
  wanderlight,
  '找一份短工',
)
assert.equal(dangerBlockedShift?.status, 'rejected', 'ordinary work cannot silently bypass an active danger')
assert.ok(dangerBlockedShift?.reasons.some((reason) => reason.includes('危险')))

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
assert.deepEqual(replylessWarning.choices.map((choice) => choice.label), contextualDangerChoiceLabels(warning.threat, warning.methods, 'zh'), 'a replyless danger turn uses configured methods bound to the exact threat')
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

console.log(JSON.stringify({ ok: true, scopedThreatRuns, checks: ['location-varied-threat-selection', 'location-scoped-threat-matrix', 'scheduled-threat-visible-establishment', 'scheduled-threat-reducer-defense', 'scheduled-threat-positive-control', 'active-danger-blocks-work', 'active-threat-stability', 'replyless-danger-methods', 'plain-language-methods', 'legacy-method-copy-migration'] }))
