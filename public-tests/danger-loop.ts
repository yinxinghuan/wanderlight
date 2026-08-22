import assert from 'node:assert/strict'
import { DEFAULT_CARTRIDGE_ID, resolveCartridge } from '../src/story/cartridges'
import { buildDangerDirective, createDangerFallbackScene, repairLegacyDangerLoopChoices } from '../src/story/engine/dangerDirector'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createChoiceRecordBlock, createInitialSave } from '../src/story/engine/reducer'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'

const cartridge = resolveCartridge(DEFAULT_CARTRIDGE_ID, 'zh')
assert.ok(cartridge.dangerDirector, 'cartridge must configure danger')
const threat = cartridge.dangerDirector.threatPalette[0]
assert.ok(threat, 'cartridge must expose at least one threat')

let save = createInitialSave(cartridge)
save = {
  ...save,
  scene: Math.max(save.scene, cartridge.dangerDirector.graceScenes ?? 0),
  danger: {
    ...save.danger,
    phase: 'warning',
    safeTurns: 0,
    severity: 2,
    currentThreat: threat,
  },
}

const action = `立即应对${threat}`
const confrontation = buildDangerDirective(save, cartridge, action)
assert.equal(confrontation?.phase, 'confrontation')

const invalid = prepareTurnCandidate({
  save,
  parsed: parseStoryProtocol('你转而处理一件无关的事。\n[choices: "等待"|"换一种方式"]', 'zh'),
  cartridge,
  action,
  dangerDirective: confrontation,
})
assert.ok(invalid.violations.length > 0, 'an unrelated generated danger reply must be rejected')

const fallback = createDangerFallbackScene(save, cartridge, confrontation!)
const preparedFallback = prepareTurnCandidate({ save, parsed: fallback, cartridge, action, dangerDirective: confrontation })
assert.deepEqual(preparedFallback.violations, [], 'the deterministic danger fallback must pass the same turn gate')

save = applyParsedScene(save, fallback, cartridge, action, undefined, undefined, confrontation)
assert.equal(save.danger.phase, 'confrontation', 'fallback advances warning to confrontation')
assert.ok(save.choices.length > 0 && save.choices.every((choice) => choice.label.includes(threat)), 'fallback replies name the exact threat')

const resolution = buildDangerDirective(save, cartridge, save.choices[0].label)
assert.equal(resolution?.phase, 'resolution')
save = applyParsedScene(
  save,
  createDangerFallbackScene(save, cartridge, resolution!),
  cartridge,
  save.choices[0].label,
  undefined,
  undefined,
  resolution,
)
assert.equal(save.danger.phase, 'calm', 'the local resolution closes the same danger thread')
assert.ok(save.choices.length > 0, 'resolution leaves at least one playable follow-up')
assert.ok(!save.blocks.some((block) => block.id.startsWith('consistency-recovery-')), 'fallback never installs generic recovery')

const legacyScene = save.scene + 1
const legacyChoices = [
  { id: 'legacy-loop-0', label: `查看${save.location}现在能做的事` },
  { id: 'legacy-loop-1', label: '放弃原计划，改走别的路' },
]
const legacy = {
  ...save,
  scene: legacyScene,
  danger: { ...save.danger, phase: 'warning' as const, currentThreat: threat },
  choices: legacyChoices,
  blocks: [
    ...save.blocks,
    { id: `consistency-recovery-${legacyScene}`, kind: 'narration' as const, text: '旧版恢复场景' },
    createChoiceRecordBlock(legacyScene, legacyChoices),
  ],
}
const migrated = repairLegacyDangerLoopChoices(legacy, cartridge)
assert.ok(migrated.choices.every((choice) => choice.label.includes(threat)), 'legacy recovery choices migrate to threat-bound actions')
assert.equal(migrated.facts['danger-loop-repaired-v1'], true)
assert.deepEqual(repairLegacyDangerLoopChoices(migrated, cartridge), migrated, 'migration is idempotent')

const authored = {
  ...legacy,
  blocks: legacy.blocks.filter((block) => block.id !== `consistency-recovery-${legacyScene}`),
  choices: [{ id: 'authored', label: `检查${threat}留下的痕迹` }],
}
assert.deepEqual(repairLegacyDangerLoopChoices(authored, cartridge), authored, 'normal authored danger choices remain untouched')

console.log(JSON.stringify({
  ok: true,
  checks: [
    'double-invalid-response-detected',
    'deterministic-fallback-valid',
    'warning-advances',
    'resolution-closes-thread',
    'no-generic-recovery',
    'legacy-save-migration',
    'authored-choice-preservation',
  ],
}))
