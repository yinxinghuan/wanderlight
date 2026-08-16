import assert from 'node:assert/strict'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { repairEndedSessionChoices, resolveDomainAction } from '../src/story/engine/domainRules'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createChoiceRecordBlock, createInitialSave } from '../src/story/engine/reducer'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'
import type { StoryCartridge, StorySave } from '../src/story/types'

function commitGenerated(save: StorySave, cartridge: StoryCartridge, action: string, content: string): StorySave {
  const candidate = prepareTurnCandidate({ save, cartridge, action, parsed: parseStoryProtocol(content, cartridge.locale) })
  assert.deepEqual(candidate.violations, [], `${cartridge.locale}/${action}: ${candidate.violations.join(', ')}`)
  return applyParsedScene(save, candidate.parsed, cartridge, action)
}

function commitDomain(save: StorySave, cartridge: StoryCartridge, action: string): StorySave {
  const resolution = resolveDomainAction(save, cartridge, action)
  assert.ok(resolution, `${cartridge.locale}: no domain resolution for ${action}`)
  return applyParsedScene(save, parseStoryProtocol(resolution.successText, cartridge.locale), cartridge, action, undefined, undefined, undefined, resolution)
}

function assertSaveInvariants(save: StorySave, cartridge: StoryCartridge, label: string) {
  for (const definition of cartridge.statDefinitions) {
    const value = save.stats[definition.id]
    assert.ok(Number.isFinite(value) && value >= definition.min && value <= definition.max, `${label}: ${definition.id} out of range`)
  }
  assert.equal(save.map.filter((node) => node.current).length, 1, `${label}: exactly one current map node`)
  assert.equal(new Set(save.choices.map((choice) => choice.label)).size, save.choices.length, `${label}: no duplicate live choices`)
  assert.ok(save.choices.length <= 5, `${label}: at most five grounded choices`)
  if (save.sessionEnded) assert.equal(save.choices.length, 0, `${label}: checkpoint has no stale ordinary choices`)
  const settled = save.jobs.filter((job) => job.status === 'settled').map((job) => job.id)
  assert.equal(new Set(settled).size, settled.length, `${label}: a contract settles once`)
}

function paymentJourney(cartridge: StoryCartridge) {
  const zh = cartridge.locale === 'zh'
  let save = createInitialSave(cartridge)
  const location = save.location
  const offerAction = zh ? '询问码头装箱工作' : 'Ask about packing work at the quay'
  save = commitGenerated(save, cartridge, offerAction, zh
    ? `码头负责人指着三只木箱说，要你装好三只木箱，完成后会付你八枚钱币；动手前可以先确认木箱封装顺序。\n[job: action="offer" id="matrix-crate-job" label="装好三只木箱" employer="码头负责人" wage="8"]\n[scene_location: location="${location}"]\n[choices: "确认木箱封装顺序"]`
    : `The quay supervisor points to three wooden cases and says the completed packing work will pay you 8 coins; before starting, you can confirm the case-packing order.\n[job: action="offer" id="matrix-crate-job" label="Pack three wooden cases" employer="Quay supervisor" wage="8"]\n[scene_location: location="${location}"]\n[choices: "Confirm the case-packing order"]`)
  assert.equal(save.stats.coin, 6, `${cartridge.locale}: offer does not pay early`)
  assert.equal(save.jobs.find((job) => job.id === 'matrix-crate-job')?.status, 'offered')

  const middleAction = save.choices[0].label
  save = commitGenerated(save, cartridge, middleAction, zh
    ? `你和码头负责人确认了木箱的封装顺序；下一步是装好三只木箱并领取工钱，八枚钱币仍要等全部装好后结算。\n[scene_location: location="${location}"]\n[choices: "装好三只木箱并领取工钱"]`
    : `You confirm the packing order with the quay supervisor. The next step is to pack all three cases and collect the wage; the 8 coins remain due only after all three cases are packed.\n[scene_location: location="${location}"]\n[choices: "Pack all three cases and collect the wage"]`)
  assert.equal(save.stats.coin, 6, `${cartridge.locale}: an intermediate promise still does not pay`)
  assert.equal(save.jobs.find((job) => job.id === 'matrix-crate-job')?.status, 'offered')

  const settleAction = save.choices[0].label
  save = commitGenerated(save, cartridge, settleAction, zh
    ? `你装好三只木箱。码头负责人验收后，把八枚钱币递给你作为工钱；空下来的装箱台上还压着下一批货单。\n[job: action="settle" id="matrix-crate-job"]\n[scene_location: location="${location}"]\n[choices: "查看装箱台上的下一批货单"]`
    : `You finish packing all three cases. After checking them, the quay supervisor hands you 8 coins as your wage; the now-empty packing table still holds the next cargo sheet.\n[job: action="settle" id="matrix-crate-job"]\n[scene_location: location="${location}"]\n[choices: "Check the next cargo sheet on the packing table"]`)
  assert.equal(save.stats.coin, 14, `${cartridge.locale}: exact wage settles once on completion`)
  assert.equal(save.jobs.find((job) => job.id === 'matrix-crate-job')?.status, 'settled')
  assertSaveInvariants(save, cartridge, `${cartridge.locale}/payment`)
}

function purchaseAndCheckpointJourney(cartridge: StoryCartridge) {
  const zh = cartridge.locale === 'zh'
  let save = createInitialSave(cartridge)
  save.stats.coin = 20
  const location = save.location
  const ask = zh ? '先询问房价' : 'Ask the room price first'
  save = commitGenerated(save, cartridge, ask, zh
    ? `旅店招待告诉你，空房一晚需要十枚钱币。你只是询问，还没有付款。\n[scene_location: location="${location}"]\n[choices: "支付房费并住一晚"]`
    : `The inn attendant says an available room costs ten coins for the night. You only ask and do not pay yet.\n[scene_location: location="${location}"]\n[choices: "Pay for the room and stay overnight"]`)
  assert.equal(save.stats.coin, 20, `${cartridge.locale}: asking a price does not spend`)
  save = commitDomain(save, cartridge, save.choices[0].label)
  assert.equal(save.stats.coin, 10, `${cartridge.locale}: explicit room purchase deducts exactly ten`)
  assert.equal(save.sessionEnded, true, `${cartridge.locale}: overnight stay creates a checkpoint`)
  assert.equal(save.choices.length, 0, `${cartridge.locale}: checkpoint clears choices`)
  const restored = repairEndedSessionChoices(JSON.parse(JSON.stringify(save)), cartridge)
  assert.deepEqual(repairEndedSessionChoices(restored, cartridge), restored, `${cartridge.locale}: checkpoint repair is idempotent`)
  assertSaveInvariants(restored, cartridge, `${cartridge.locale}/purchase-checkpoint`)
}

function insertedRestJourney(cartridge: StoryCartridge) {
  const zh = cartridge.locale === 'zh'
  let save = createInitialSave(cartridge)
  save.scene = 7
  save.objective = zh ? '核对失踪货船最后一次靠岸的记录。' : 'Verify the missing freighter’s last docking record.'
  save.decisionContext = zh ? '登记簿仍摊在桌上，证人的说法还没核对。' : 'The ledger remains open and the witness account is not yet checked.'
  save.choices = [
    { id: 'question', label: zh ? '请证人补充最后靠岸的时间' : 'Ask the witness for the last docking time' },
    { id: 'rest', label: zh ? '原地休息' : 'Rest in place' },
  ]
  save.blocks.push(createChoiceRecordBlock(save.scene, save.choices))
  const beforeEnergy = save.stats.energy
  save = commitDomain(save, cartridge, save.choices[1].label)
  assert.equal(save.objective, zh ? '核对失踪货船最后一次靠岸的记录。' : 'Verify the missing freighter’s last docking record.')
  assert.equal(save.decisionContext, zh ? '登记簿仍摊在桌上，证人的说法还没核对。' : 'The ledger remains open and the witness account is not yet checked.')
  assert.deepEqual(save.choices.map((choice) => choice.label), [zh ? '请证人补充最后靠岸的时间' : 'Ask the witness for the last docking time'], `${cartridge.locale}: rest resumes the unperformed sibling`)
  assert.equal(save.stats.energy, Math.min(100, beforeEnergy + 8), `${cartridge.locale}: rest restores energy once`)

  const action = save.choices[0].label
  save = commitGenerated(save, cartridge, action, zh
    ? `证人翻着登记簿，补充说失踪货船最后一次在午夜前靠岸。你们仍需核对码头记录。\n[scene_location: location="${save.sceneLocation}"]\n[choices: "继续核对失踪货船的码头记录"]`
    : `The witness checks the ledger and says the missing freighter last docked before midnight. The quay record still needs verification.\n[scene_location: location="${save.sceneLocation}"]\n[choices: "Continue checking the missing freighter’s quay record"]`)
  assert.match(save.choices[0].label, zh ? /失踪货船/ : /missing freighter/i)
  assertSaveInvariants(save, cartridge, `${cartridge.locale}/inserted-rest`)
}

function dynamicLocationJourney(cartridge: StoryCartridge) {
  const zh = cartridge.locale === 'zh'
  let save = createInitialSave(cartridge)
  const label = zh ? '蓝灯盐沼' : 'Blue-Lantern Saltmarsh'
  const scene = zh ? '蓝灯盐沼的旧泵房' : 'the old pump house in Blue-Lantern Saltmarsh'
  const inspect = zh ? '检查蓝灯盐沼的旧泵房' : 'Inspect the old pump house in Blue-Lantern Saltmarsh'
  save = commitGenerated(save, cartridge, zh ? '沿退潮石路前往蓝灯盐沼' : 'Follow the ebb-stone road to Blue-Lantern Saltmarsh', zh
    ? `你沿退潮石路离开码头，抵达蓝灯盐沼。沼地中央的旧泵房亮着一盏蓝灯。\n[map_update: new_location="${label}" location_id="blue-lantern-saltmarsh" connected_to="${save.location}" detail="沼地中央的旧泵房亮着蓝灯" route_hints="盐沼|旧泵房|蓝灯"]\n[scene_location: location="${scene}"]\n[choices: "${inspect}"]`
    : `You follow the ebb-stone road away from the quay and reach Blue-Lantern Saltmarsh. A blue lamp burns in the old pump house at its center.\n[map_update: new_location="${label}" location_id="blue-lantern-saltmarsh" connected_to="${save.location}" detail="A blue lamp burns in the old pump house" route_hints="saltmarsh|old pump house|blue lamp"]\n[scene_location: location="${scene}"]\n[choices: "${inspect}"]`)
  assert.equal(save.location, label)
  assert.equal(save.sceneLocation, scene)
  assert.equal(save.map.filter((node) => node.id === 'blue-lantern-saltmarsh').length, 1)

  save = commitGenerated(save, cartridge, inspect, zh
    ? `你在蓝灯盐沼的旧泵房里找到一组仍能转动的潮位齿轮。蓝灯依旧照着门口。\n[scene_location: location="${scene}"]\n[choices: "记录旧泵房的潮位齿轮"]`
    : `Inside the old pump house in Blue-Lantern Saltmarsh, you find tide gears that still turn. The blue lamp continues to mark the door.\n[scene_location: location="${scene}"]\n[choices: "Record the tide gears in the old pump house"]`)
  const restored = JSON.parse(JSON.stringify(save)) as StorySave
  assert.equal(restored.location, label, `${cartridge.locale}: generated map node survives reload`)
  assert.equal(restored.sceneLocation, scene, `${cartridge.locale}: generated exact scene survives reload`)
  assert.equal(restored.map.filter((node) => node.id === 'blue-lantern-saltmarsh').length, 1, `${cartridge.locale}: reload does not duplicate the node`)
  assertSaveInvariants(restored, cartridge, `${cartridge.locale}/dynamic-location`)
}

function generatedCharacterJourney(cartridge: StoryCartridge) {
  const zh = cartridge.locale === 'zh'
  let save = createInitialSave(cartridge)
  const location = save.location
  const debut = zh
    ? `雨棚下，一个戴银叶胸针的成年女人正扶起倒下的路牌。摊主喊她“伊莱拉”；她回头说明自己熟悉旧桥，也愿意和你一起去核对潮位。\n[伊莱拉] [main] [坦率]: "旧桥还能走，但我们得在涨潮前回来。"\n[character_update: character_id="elara-venn" character="伊莱拉" role="30 岁 · 旧桥向导" visual_appearance="One adult woman age 30, short black curls, silver leaf brooch, ochre raincoat" visual_traits="age 30|short black curls|silver leaf brooch" visual_wardrobe="ochre raincoat" visual_forbidden="age drift|hair drift|missing brooch"]\n[party_change: character_id="elara-venn" character="伊莱拉" change="add"]\n[scene_location: location="${location}"]\n[choices: "询问伊莱拉旧桥的潮位"]`
    : `Under the awning, an adult woman with short black curls and a silver leaf brooch lifts a fallen road sign. A vendor says she is called “Elara”; she explains that she knows the old bridge and agrees to join you and check the tide.\n[Elara] [main] [candid]: "The old bridge still holds, but we must return before high tide."\n[character_update: character_id="elara-venn" character="Elara" role="Age 30 · old-bridge guide" visual_appearance="One adult woman age 30, short black curls, silver leaf brooch, ochre raincoat" visual_traits="age 30|short black curls|silver leaf brooch" visual_wardrobe="ochre raincoat" visual_forbidden="age drift|hair drift|missing brooch"]\n[party_change: character_id="elara-venn" character="Elara" change="add"]\n[scene_location: location="${location}"]\n[choices: "Ask Elara about the old bridge tide"]`
  save = commitGenerated(save, cartridge, zh ? '和新认识的向导交谈' : 'Talk with the newly met guide', debut)
  assert.ok(save.partyMemberIds.includes('elara-venn'), `${cartridge.locale}: visible debut can join the party`)

  const action = save.choices[0].label
  save = commitGenerated(save, cartridge, action, zh
    ? `伊莱拉摊开潮位表，指出旧桥东侧在午夜前仍可通行。她答应继续和你同行。\n[伊莱拉] [main] [认真]: "先核对东侧桥墩，再决定是否过桥。"\n[reputation: npc="伊莱拉" action="trusted"]\n[scene_location: location="${location}"]\n[choices: "和伊莱拉核对东侧桥墩"]`
    : `Elara opens the tide table and points out that the east side of the old bridge remains passable until midnight. She agrees to keep traveling with you.\n[Elara] [main] [focused]: "Check the eastern pier first, then decide whether to cross."\n[reputation: npc="Elara" action="trusted"]\n[scene_location: location="${location}"]\n[choices: "Check the eastern pier with Elara"]`)
  const restored = JSON.parse(JSON.stringify(save)) as StorySave
  assert.equal(restored.characters.filter((character) => character.id === 'elara-venn').length, 1, `${cartridge.locale}: character id stays unique after reload`)
  assert.ok(restored.partyMemberIds.includes('elara-venn'), `${cartridge.locale}: party membership survives reload`)
  assert.ok(restored.relationships.some((event) => event.characterId === 'elara-venn'), `${cartridge.locale}: relationship event stays bound to the same id`)
  assertSaveInvariants(restored, cartridge, `${cartridge.locale}/generated-character`)
}

function recoveryGateJourney(cartridge: StoryCartridge) {
  const zh = cartridge.locale === 'zh'
  let save = createInitialSave(cartridge)
  save.scene = 10
  save.stats.energy = 10
  save.objective = zh ? '完成码头登记工作。' : 'Complete the quay registration shift.'
  save.choices = [
    { id: 'work', label: zh ? '找一份短工' : 'Look for a short job' },
    { id: 'rest', label: zh ? '原地休息' : 'Rest in place' },
  ]
  save.blocks.push(createChoiceRecordBlock(save.scene, save.choices))
  const before = { ...save.stats }
  save = commitDomain(save, cartridge, save.choices[0].label)
  assert.deepEqual(save.stats, before, `${cartridge.locale}: rejected low-energy work has zero partial effects`)
  assert.equal(save.objective, zh ? '完成码头登记工作。' : 'Complete the quay registration shift.')

  save = commitDomain(save, cartridge, zh ? '原地休息' : 'Rest in place')
  assert.equal(save.stats.energy, 18, `${cartridge.locale}: ordinary rest works above zero and restores exactly eight`)
  save = commitDomain(save, cartridge, zh ? '找一份短工' : 'Look for a short job')
  assert.equal(save.stats.energy, 8, `${cartridge.locale}: recovered player can complete the work`)
  assert.equal(save.stats.coin, 15, `${cartridge.locale}: completed local work pays exactly nine`)
  const afterPaid = { ...save.stats }
  save = commitDomain(save, cartridge, zh ? '再找一份短工' : 'Look for another short job')
  assert.deepEqual(save.stats, afterPaid, `${cartridge.locale}: same-place same-day repeat cannot pay or drain again`)
  assertSaveInvariants(save, cartridge, `${cartridge.locale}/recovery-gate`)
}

for (const cartridge of [wanderlight, wanderlightEn]) {
  paymentJourney(cartridge)
  purchaseAndCheckpointJourney(cartridge)
  insertedRestJourney(cartridge)
  dynamicLocationJourney(cartridge)
  generatedCharacterJourney(cartridge)
  recoveryGateJourney(cartridge)
}

console.log(JSON.stringify({
  ok: true,
  trajectories: 12,
  locales: ['zh', 'en'],
  checks: ['offer-middle-settlement', 'inquiry-consent-checkpoint', 'inserted-rest-resume', 'generated-location-reload', 'generated-character-relation-reload', 'reject-recover-work-repeat'],
}))
