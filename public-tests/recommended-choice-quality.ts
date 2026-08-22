import { strict as assert } from 'node:assert'
import { listCartridges } from '../src/story/cartridges/index'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'

function choiceLabels(prepared: ReturnType<typeof prepareTurnCandidate>): string[] {
  const command = [...prepared.parsed.commands].reverse().find((entry) => entry.type === 'choices')
  return command?.type === 'choices' ? command.choices : []
}

let cases = 0
for (const locale of ['zh', 'en'] as const) {
  const cartridge = listCartridges(locale)[0]
  const opening = createInitialSave(cartridge)
  const zh = locale === 'zh'
  const location = zh ? '灯湾码头仓房' : 'Lantern Quay warehouse'
  const threat = zh ? '俘虏的同伴试图闯入仓房营救' : "the prisoner's allies trying to break into the warehouse to rescue him"
  const objective = zh ? '阻止营救者闯入仓房并看守俘虏' : 'Stop the rescuers entering the warehouse and guard the prisoner'
  const active = {
    ...opening,
    scene: 12,
    location,
    sceneLocation: location,
    objective,
    danger: { ...opening.danger, phase: 'confrontation' as const, currentThreat: threat, severity: 3 },
    map: [...opening.map.map((node) => ({ ...node, current: false })), { id: 'quay-warehouse', label: location, current: true, visited: true }],
  }

  const action = zh ? '和媛夕确认仓门的薄弱处' : 'Check the weak warehouse latch with Mira'
  const concrete = zh ? '把货箱推到薄弱仓门后' : 'Push the cargo behind the weak warehouse door'
  const generic = zh
    ? ['和其他人商量怎么办', '观察现场的新变化', '等待', '换一种方式处理当前局面']
    : ['Discuss with others what to do', 'Discuss what to do with the companions', 'Observe what changed around here', 'Wait and see', 'Try another way']
  const continuing = prepareTurnCandidate({
    save: active,
    cartridge,
    action,
    parsed: parseStoryProtocol(zh
      ? `俘虏的同伴仍在仓门外试图营救。媛夕指出薄弱仓门，旁边的货箱足以顶住它。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]\n[choices: "${generic[0]}"|"${concrete}"|"${generic[1]}"|"${generic[2]}"|"${generic[3]}"]`
      : `The prisoner's allies are still outside trying to rescue him. Mira points out the weak warehouse door and cargo that can brace it.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]\n[choices: "${generic[0]}"|"${concrete}"|"${generic[1]}"|"${generic[2]}"|"${generic[3]}"]`, locale),
  })
  assert.deepEqual(choiceLabels(continuing), [concrete], `${locale}: generic thread-breaking replies are removed while the concrete response survives`)
  assert.deepEqual(continuing.violations, [], `${locale}: one concrete conflict response remains committable`)
  cases += 1

  const repeatedAction = zh ? '检查薄弱仓门' : 'Inspect the weak warehouse door'
  const repeated = prepareTurnCandidate({
    save: active,
    cartridge,
    action: repeatedAction,
    parsed: parseStoryProtocol(zh
      ? `你确认薄弱仓门的门闩已经松动，货箱就在手边。俘虏的同伴仍在门外试图营救。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]\n[choices: "继续检查薄弱仓门"|"${concrete}"]`
      : `You confirm that the weak warehouse door has a loose latch and cargo is within reach. The prisoner's allies are still outside trying to rescue him.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]\n[choices: "Continue inspecting the weak warehouse door"|"${concrete}"]`, locale),
  })
  assert.deepEqual(choiceLabels(repeated), [concrete], `${locale}: an immediate retry-prefixed copy of the completed action is removed`)
  cases += 1

  const objectiveRestatement = prepareTurnCandidate({
    save: active,
    cartridge,
    action,
    parsed: parseStoryProtocol(zh
      ? `俘虏的同伴仍在仓门外试图营救，货箱就在薄弱门闩旁。
[scene_location: location="${location}"]
[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]
[choices: "${objective}"|"${concrete}"]`
      : `The prisoner's allies are still trying to break in, and cargo sits beside the weak warehouse door.
[scene_location: location="${location}"]
[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]
[choices: "${objective}"|"${concrete}"]`, locale),
  })
  assert.deepEqual(choiceLabels(objectiveRestatement), [concrete], `${locale}: the objective is context, not an executable recommendation`)
  cases += 1

  const genericOnly = prepareTurnCandidate({
    save: active,
    cartridge,
    action,
    parsed: parseStoryProtocol(zh
      ? `俘虏的同伴仍堵在仓门外，营救没有结束。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]\n[choices: "${generic[0]}"|"${generic[1]}"|"${generic[2]}"]`
      : `The prisoner's allies still block the warehouse door, and the rescue attempt is not over.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${threat}" severity="3" outcome="active"]\n[choices: "${generic[0]}"|"${generic[1]}"|"${generic[2]}"]`, locale),
  })
  assert.deepEqual(choiceLabels(genericOnly), [], `${locale}: an all-placeholder recommendation set is quarantined`)
  assert.equal(genericOnly.canCommitWithoutReplies, true, `${locale}: valid conflict prose can commit without exposing bad replies`)
  const recovered = applyParsedScene(active, genericOnly.parsed, cartridge, action)
  assert.ok(recovered.choices.length >= 1, `${locale}: reducer restores an executable tray`)
  assert.ok(recovered.choices.every((choice) => !generic.includes(choice.label)), `${locale}: bad recommendations do not return through recovery`)
  assert.ok(recovered.choices.some((choice) => choice.label.includes(zh ? '营救' : 'prisoner')), `${locale}: recovery stays on the unresolved conflict objective: ${JSON.stringify(recovered.choices)}`)
  cases += 1
}

console.log(JSON.stringify({ ok: true, locales: 2, cases, checks: ['generic-placeholder-filter', 'immediate-repeat-filter', 'objective-is-not-an-action', 'active-thread-recovery'] }))
