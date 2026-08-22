import { strict as assert } from 'node:assert'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { buildDangerDirective, contextualDangerChoiceLabels } from '../src/story/engine/dangerDirector'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave, createRecoveryChoices } from '../src/story/engine/reducer'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'

const initial = createInitialSave(wanderlight)
initial.objective = '审问刚抓到的俘虏'

const missingEncounter = prepareTurnCandidate({
  save: initial,
  cartridge: wanderlight,
  action: '把俘虏带回来审问',
  parsed: parseStoryProtocol(`你把刚抓到的俘虏带回仓房审问，媛夕留在你身边。突然，他的同伴从码头另一侧冲来，试图闯进仓房把俘虏救走。
[scene_location: location="灯湾码头"]
[choices: "审问刚抓到的俘虏"]`, 'zh'),
})
assert.equal(missingEncounter.violations.includes('turn.visible_immediate_threat_requires_encounter'), true, '可见营救冲突必须进入权威 encounter 状态')

const established = prepareTurnCandidate({
  save: initial,
  cartridge: wanderlight,
  action: '把俘虏带回来审问',
  parsed: parseStoryProtocol(`你把刚抓到的俘虏带回仓房审问，媛夕留在你身边。突然，他的同伴从码头另一侧冲来，试图闯进仓房把俘虏救走。
[scene_location: location="灯湾码头"]
[encounter: phase="confrontation" kind="俘虏的同伴赶来营救" severity="3" outcome="active"]
[choices: "守住仓房"]`, 'zh'),
})
assert.deepEqual(established.violations, [], '带 encounter 的营救冲突应当可以提交')
let save = applyParsedScene(initial, established.parsed, wanderlight, '把俘虏带回来审问')
assert.equal(save.danger.phase, 'confrontation')
assert.equal(save.danger.currentThreat, '俘虏的同伴赶来营救')

const droppedThread = prepareTurnCandidate({
  save,
  cartridge: wanderlight,
  action: '和同行者商量下一步',
  parsed: parseStoryProtocol(`你和媛夕重新整理了之后的调查计划，决定明早再去葡萄丘。
[scene_location: location="灯湾码头"]
[choices: "明早前往葡萄丘"]`, 'zh'),
})
assert.equal(droppedThread.violations.includes('turn.active_threat_requires_continuation'), true, '商量不能让正在营救的同伴凭空消失')

const directive = buildDangerDirective(save, wanderlight, '和同行者商量下一步')
assert.equal(directive?.phase, 'resolution')
const resolved = prepareTurnCandidate({
  save,
  cartridge: wanderlight,
  action: '和同行者商量下一步',
  parsed: parseStoryProtocol(`你和媛夕当场商量后用木箱堵住仓门。俘虏的同伴无法突破，只得撤退到码头外侧；营救行动已经被阻止，俘虏仍在你们看守下。
[scene_location: location="灯湾码头"]
[encounter: phase="resolution" kind="俘虏的同伴赶来营救" severity="3" outcome="success"]
[choices: "检查木箱堵住的仓门"]`, 'zh'),
})
assert.deepEqual(resolved.violations, [], '明确交代威胁去向后才能结束活动线程')
save = applyParsedScene(save, resolved.parsed, wanderlight, '和同行者商量下一步', undefined, undefined, directive)
assert.equal(save.danger.phase, 'calm')
assert.equal(save.blocks.some((block) => /同伴无法突破，只得撤退/.test(block.text)), true)

const ordinaryRecovery = createRecoveryChoices({ ...initial, partyMemberIds: ['mira'] }, wanderlight)
assert.deepEqual(ordinaryRecovery.map((choice) => choice.label), ['审问刚抓到的俘虏'], '有未完事项时不混入观察或泛化商量按钮')
const dangerRecovery = createRecoveryChoices({ ...save, danger: { ...save.danger, phase: 'confrontation', currentThreat: '俘虏的同伴赶来营救' } }, wanderlight)
assert.deepEqual(dangerRecovery.map((choice) => choice.label), contextualDangerChoiceLabels('俘虏的同伴赶来营救', wanderlight.dangerDirector!.methods, 'zh'), '活动威胁恢复使用世界声明的方法并写出具体威胁')

console.log(JSON.stringify({ ok: true, checks: ['threat-establishment', 'nonresolving-action-preserves-thread', 'visible-resolution', 'objective-only-recovery', 'danger-native-recovery'] }))
