import { strict as assert } from 'node:assert'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { buildDangerDirective } from '../src/story/engine/dangerDirector'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
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

console.log(JSON.stringify({ ok: true, checks: ['location-varied-threat-selection', 'active-threat-stability', 'replyless-danger-methods'] }))
