import assert from 'node:assert/strict'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { buildDangerDirective } from '../src/story/engine/dangerDirector'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'
import type { StoryCartridge, StorySave } from '../src/story/types'

function prepare(save: StorySave, cartridge: StoryCartridge, action: string, content: string) {
  return prepareTurnCandidate({ save, cartridge, action, parsed: parseStoryProtocol(content, cartridge.locale) })
}

function runThreatJourney(cartridge: StoryCartridge) {
  const zh = cartridge.locale === 'zh'
  let save = createInitialSave(cartridge)
  save.objective = zh ? '继续审问仓房里的俘虏。' : 'Continue questioning the prisoner in the warehouse.'
  const location = save.location
  const kind = zh ? '俘虏的同伴赶来营救' : "the prisoner's allies arrive to rescue him"

  const establish = prepare(save, cartridge, zh ? '把俘虏带回仓房' : 'Bring the prisoner back to the warehouse', zh
    ? `你把俘虏带回仓房。突然，俘虏的同伴从码头冲来，试图闯进仓房把他救走。你可以用货箱顶住仓门，或从侧窗观察营救者。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "用货箱顶住仓门"|"从侧窗观察营救者"]`
    : `You bring the prisoner into the warehouse. Suddenly, the prisoner's allies charge from the quay and try to break in to rescue him. You can brace the warehouse door with cargo or watch the rescuers through the side window.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "Brace the warehouse door with cargo"|"Watch the rescuers through the side window"]`)
  assert.deepEqual(establish.violations, [], `${cartridge.locale}: visible rescue must establish one playable threat`)
  save = applyParsedScene(save, establish.parsed, cartridge, zh ? '把俘虏带回仓房' : 'Bring the prisoner back to the warehouse')
  assert.equal(save.danger.phase, 'confrontation')

  const continuations = zh ? [
    ['从侧窗观察营救者', `俘虏的同伴仍在仓门外试图营救。你从侧窗看见两人正寻找门闩的薄弱处，可以把货箱推到薄弱门闩后。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "把货箱推到薄弱门闩后"]`],
    ['和媛夕商量如何守门', `俘虏的同伴没有离开，仍在仓门外营救。你和媛夕当场商量，把货箱推到薄弱门闩后；现在可以守住仓门并要求对方撤退。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "守住仓门并要求对方撤退"]`],
    ['等待对方下一步动作', `俘虏的同伴仍包围着仓房，营救行动没有结束。你守在门后等待他们的下一步动作，也可以隔着仓门要求营救者撤退。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "隔着仓门要求营救者撤退"]`],
  ] : [
    ['Watch the rescuers through the side window', `The prisoner's allies remain outside the warehouse trying to rescue him. Through the side window, you see two of them testing a weak door latch, so you can push cargo behind the weak door latch.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "Push cargo behind the weak door latch"]`],
    ['Discuss how to hold the door with Mira', `The prisoner's allies have not left and are still trying to rescue him. You and Mira confer on the spot and push cargo behind the weak door latch; you can now hold the warehouse door and demand their withdrawal.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "Hold the warehouse door and demand their withdrawal"]`],
    ['Wait for their next move', `The prisoner's allies still surround the warehouse, and the rescue attempt has not ended. You wait behind the door for their next move, or demand through the door that the rescuers withdraw.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="${kind}" severity="3" outcome="active"]\n[choices: "Demand through the door that the rescuers withdraw"]`],
  ]

  for (const [action, content] of continuations) {
    const candidate = prepare(save, cartridge, action, content)
    assert.deepEqual(candidate.violations, [], `${cartridge.locale}: non-resolving action must keep the same active threat: ${action}`)
    save = applyParsedScene(save, candidate.parsed, cartridge, action)
    assert.equal(save.danger.phase, 'confrontation')
    assert.equal(save.danger.currentThreat, kind)
  }

  const unrelated = prepare(save, cartridge, zh ? '看看码头的灯' : 'Look at the quay lights', zh
    ? `码头的灯忽然熄灭，你决定明早再检查线路。\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="码头突然停电" severity="2" outcome="active"]\n[choices: "检查码头电线"]`
    : `The quay lights go out, and you decide to inspect the wiring tomorrow.\n[scene_location: location="${location}"]\n[encounter: phase="confrontation" kind="a quay power outage" severity="2" outcome="active"]\n[choices: "Inspect the quay wiring"]`)
  assert.ok(unrelated.violations.includes('turn.active_threat_cannot_disappear'), `${cartridge.locale}: an unrelated encounter cannot replace the live rescue`)

  const missing = prepare(save, cartridge, zh ? '和媛夕商量明天的路线' : "Discuss tomorrow's route with Mira", zh
    ? `你和媛夕摊开地图，决定明早去葡萄丘。\n[scene_location: location="${location}"]\n[choices: "明早前往葡萄丘"]`
    : `You and Mira open the map and decide to visit the vineyard tomorrow.\n[scene_location: location="${location}"]\n[choices: "Travel to the vineyard tomorrow"]`)
  assert.ok(missing.violations.includes('turn.active_threat_requires_continuation'), `${cartridge.locale}: planning cannot erase the live rescue`)

  const directive = buildDangerDirective(save, cartridge, zh ? '守住仓门并要求撤退' : 'Hold the door and demand a withdrawal')
  const resolution = prepare(save, cartridge, zh ? '守住仓门并要求撤退' : 'Hold the door and demand a withdrawal', zh
    ? `你守住仓门并发出警告。俘虏的同伴无法突破，只得从码头撤退；营救已经被阻止，俘虏仍在看守下。你可以询问俘虏为何盯着撤退方向。\n[scene_location: location="${location}"]\n[encounter: phase="resolution" kind="${kind}" severity="3" outcome="success"]\n[choices: "询问俘虏为何盯着撤退方向"]`
    : `You hold the warehouse door and issue a warning. The prisoner's allies are repelled and withdraw from the quay; the rescue is stopped, and the prisoner remains under guard. You can ask the prisoner why he watches the direction of retreat.\n[scene_location: location="${location}"]\n[encounter: phase="resolution" kind="${kind}" severity="3" outcome="success"]\n[choices: "Ask the prisoner why he watches the direction of retreat"]`)
  assert.deepEqual(resolution.violations, [], `${cartridge.locale}: only visible same-thread resolution may close the rescue`)
  save = applyParsedScene(save, resolution.parsed, cartridge, zh ? '守住仓门并要求撤退' : 'Hold the door and demand a withdrawal', undefined, undefined, directive)
  assert.equal(save.danger.phase, 'calm')
  assert.match(save.choices[0]?.label ?? '', zh ? /询问俘虏.*撤退方向/ : /ask the prisoner.*direction of retreat/i)

  const restored = JSON.parse(JSON.stringify(save)) as StorySave
  assert.equal(restored.danger.phase, 'calm')
  assert.equal(restored.objective, save.objective)
  assert.deepEqual(
    restored.choices.map((choice) => ({ id: choice.id, label: choice.label, target: choice.targetLocationId ?? null })),
    save.choices.map((choice) => ({ id: choice.id, label: choice.label, target: choice.targetLocationId ?? null })),
  )
  return { locale: cartridge.locale, scenes: restored.scene }
}

const results = [runThreatJourney(wanderlight), runThreatJourney(wanderlightEn)]
console.log(JSON.stringify({ ok: true, trajectories: results.length, turns: results.reduce((sum, result) => sum + result.scenes, 0), results }))
