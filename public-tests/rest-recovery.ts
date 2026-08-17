import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { domainSuppressesDanger, resolveDomainAction } from '../src/story/engine/domainRules'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { canonicalizeTurnMetadata, validateTurnConsistency } from '../src/story/engine/turnConsistency'
import type { DangerDirective, Locale, StoryCartridge, StorySave } from '../src/story/types'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

let assertions = 0
const check = (value: unknown, message: string) => { assertions += 1; ok(value, message) }
const expect = (actual: unknown, expected: unknown, message: string) => { assertions += 1; equal(actual, expected, message) }

function resolution(save: StorySave, cartridge: StoryCartridge, action: string) {
  const result = resolveDomainAction(save, cartridge, action)
  check(result, `missing local resolution for ${action}`)
  return result
}

function applyLocal(save: StorySave, cartridge: StoryCartridge, action: string, hostile = '', danger?: DangerDirective) {
  const result = resolution(save, cartridge, action)
  const parsed = parseStoryProtocol(hostile || result.successText, cartridge.locale)
  return { result, next: applyParsedScene(save, parsed, cartridge, action, undefined, undefined, danger, result) }
}

for (const [locale, cartridge] of [['zh', wanderlight], ['en', wanderlightEn]] as const) {
  const ordinaryAction = locale === 'zh' ? '原地坐下，休息四十五分钟' : 'Sit down and rest for forty-five minutes'
  for (const energy of [0, 1, 6, 11, 12, 27, 28, 72, 96, 100]) {
    const save = createInitialSave(cartridge)
    save.stats.energy = energy
    const { result, next } = applyLocal(save, cartridge, ordinaryAction)
    expect(result.ruleId, 'catch-breath', `${locale} ordinary rest is local at energy ${energy}`)
    expect(result.status, 'accepted', `${locale} ordinary rest is available before and at zero`)
    expect(next.stats.energy, Math.min(100, energy + 8), `${locale} ordinary rest applies exact bounded recovery`)
    expect(next.facts.exhaustion_recoveries, 1, `${locale} ordinary rest records once`)
    check(domainSuppressesDanger(result), `${locale} ordinary rest suppresses same-turn danger scheduling`)
  }

  const contextualActions = locale === 'zh'
    ? ['走进路边小屋休息一会儿', '在灯屋里小睡', '选择休息', '靠墙眯一会', '慢慢恢复呼吸']
    : ['Rest for a while inside the roadside hut', 'Take a nap in the lamp house', 'Choose to rest', 'Doze by the wall', 'Catch my breath']
  for (const action of contextualActions) {
    const save = createInitialSave(cartridge)
    save.stats.energy = 40
    const { result, next } = applyLocal(save, cartridge, action)
    expect(result.ruleId, 'catch-breath', `${locale} contextual rest maps to ordinary recovery: ${action}`)
    expect(next.stats.energy, 48, `${locale} contextual rest cannot become prose-only`)
    expect(next.location, save.location, `${locale} contextual rest does not invent travel`)
  }

  const contextualSave = createInitialSave(cartridge)
  const contextualNodeId = 'whitecap-baths'
  const contextualNode = contextualSave.map.find((node) => node.id === contextualNodeId)
  check(contextualNode, `${locale} Whitecap Baths exists for contextual rest test`)
  contextualSave.map.forEach((node) => { node.current = node.id === contextualNodeId })
  contextualNode.visited = true
  contextualSave.location = contextualNode.label
  contextualSave.sceneLocation = contextualNode.label
  const mira = cartridge.characters.find((character) => character.id === 'mira-voss')
  check(mira, `${locale} Mira exists for contextual rest test`)
  contextualSave.characters.push({ ...mira, skills: mira.skills.map((skill) => ({ ...skill })), status: 'known', origin: 'cartridge', lastKnownLocation: contextualNode.label, updatedAtScene: 6 })
  const contextualAction = locale === 'zh' ? '和媛夕一起去蒸汽露台休息' : 'Go rest at the Steam Terrace with Mira Voss'
  const sibling = locale === 'zh' ? '询问林叔是否还有其他需要帮忙的工作' : 'Ask Uncle Lin whether any other work needs doing'
  contextualSave.choices = [{ id: 'contextual-sibling', label: sibling }, { id: 'contextual-rest', label: contextualAction }]
  contextualSave.stats.energy = 22
  const contextualRest = applyLocal(contextualSave, cartridge, contextualAction)
  expect(contextualRest.result.ruleId, 'catch-breath', `${locale} contextual companion rest remains deterministic`)
  expect(contextualRest.next.stats.energy, 30, `${locale} contextual companion rest restores exact energy`)
  expect(contextualRest.next.location, contextualNode.label, `${locale} contextual companion rest keeps the map node`)
  expect(contextualRest.next.sceneLocation, locale === 'zh' ? '蒸汽露台' : 'steam terrace', `${locale} contextual companion rest persists the named sublocation`)
  check(contextualRest.result.successText.includes(mira.name), `${locale} contextual rest prose keeps the companion`)
  check(contextualRest.result.successText.toLocaleLowerCase().includes(locale === 'zh' ? '蒸汽露台' : 'steam terrace'), `${locale} contextual rest prose keeps the named sublocation`)
  check(!contextualRest.result.successText.includes(locale === 'zh' ? '原地坐下' : 'sit until'), `${locale} contextual rest does not fall back to in-place boilerplate`)
  expect(contextualRest.next.choices.length, 2, `${locale} contextual rest keeps one direct follow-up and the grounded sibling`)
  check(contextualRest.next.choices[0]!.label.includes(mira.name), `${locale} first contextual follow-up stays with the companion`)
  check(contextualRest.next.choices.some((choice) => choice.label === sibling), `${locale} prior grounded sibling remains available`)

  const inquiries = locale === 'zh'
    ? ['询问哪里可以休息', '看看这间屋子能不能休息', '问客房休息多少钱', '询问能不能在旅店休息']
    : ['Ask where I can rest', 'Check whether this hut is available for rest', 'Ask how much the room costs before resting', 'Ask whether I can rest at the inn']
  for (const action of inquiries) {
    const save = createInitialSave(cartridge)
    expect(resolveDomainAction(save, cartridge, action), undefined, `${locale} rest inquiry is not mistaken for consent: ${action}`)
  }
  const reportsAndNegations = locale === 'zh'
    ? ['告诉罗温今晚只想休息', '跟媛夕说自己准备休息', '不休息，继续观察', '别睡，先核对路线']
    : ['Tell Rowan I only want to rest tonight', 'Tell Mira that I plan to sleep', 'Do not rest; keep watching', "Don't sleep; check the route first"]
  for (const action of reportsAndNegations) {
    const save = createInitialSave(cartridge)
    expect(resolveDomainAction(save, cartridge, action), undefined, `${locale} reported or negated rest is not executed: ${action}`)
  }

  const morningAction = locale === 'zh' ? '结束今天，休息到清晨' : 'End the day and rest until morning'
  const morningSave = createInitialSave(cartridge)
  morningSave.stats.energy = 10
  const morning = applyLocal(morningSave, cartridge, morningAction)
  expect(morning.next.stats.energy, 46, `${locale} full-night recovery applies the authored +36 rather than model maxDelta`)
  expect(morning.next.sessionEnded, true, `${locale} full-night recovery creates a saved stop`)

  const roomAction = locale === 'zh' ? '住一晚' : 'Stay for the night'
  const roomSave = createInitialSave(cartridge)
  roomSave.stats.energy = 10
  roomSave.stats.coin = 20
  const room = applyLocal(roomSave, cartridge, roomAction)
  expect(room.next.stats.energy, 38, `${locale} paid room applies exact +28`)
  expect(room.next.stats.coin, 10, `${locale} paid room charges exact price`)
  expect(room.next.sessionEnded, true, `${locale} paid room creates a saved stop`)

  const dangerSave = createInitialSave(cartridge)
  dangerSave.stats.energy = 40
  dangerSave.danger = { phase: 'confrontation', safeTurns: 0, cycle: 2, cooldownTurns: 0, severity: 4, currentThreat: locale === 'zh' ? '封路银雨' : 'road-closing silver rain', lastOutcome: 'none' }
  const blockedRest = resolution(dangerSave, cartridge, ordinaryAction)
  expect(blockedRest.status, 'rejected', `${locale} ordinary rest is explicitly blocked during danger`)
  expect(blockedRest.effects.length, 0, `${locale} blocked danger rest is atomic`)
  const blockedResult = applyParsedScene(dangerSave, parseStoryProtocol(blockedRest.successText, locale), cartridge, ordinaryAction, undefined, undefined, undefined, blockedRest)
  expect(blockedResult.stats.energy, 40, `${locale} blocked danger rest cannot change energy`)
  expect(blockedResult.danger.phase, 'confrontation', `${locale} rejected rest freezes the active danger`)

  const retreatAction = locale === 'zh' ? '放弃当前行动，去最近的公共休息处' : 'Abandon the current action and reach the nearest public rest area'
  const retreat = applyLocal(dangerSave, cartridge, retreatAction)
  expect(retreat.result.status, 'accepted', `${locale} safe retreat remains available during danger`)
  check(retreat.result.effects.some((effect) => effect.type === 'danger'), `${locale} danger retreat owns danger resolution`)
  expect(retreat.next.stats.energy, 56, `${locale} danger retreat restores exact +16 without surprise loss`)
  expect(retreat.next.danger.phase, 'calm', `${locale} danger retreat reaches a genuinely safe state`)
  expect(retreat.next.danger.lastOutcome, 'costly-success', `${locale} retreat records its explicit tradeoff`)

  const exhaustedDanger = createInitialSave(cartridge)
  exhaustedDanger.stats.energy = 0
  exhaustedDanger.danger = { ...dangerSave.danger }
  const exhaustedRetreat = applyLocal(exhaustedDanger, cartridge, retreatAction)
  expect(exhaustedRetreat.result.status, 'accepted', `${locale} zero energy during danger still has one non-soft-locking withdrawal`)
  expect(exhaustedRetreat.next.stats.energy, 16, `${locale} zero-energy danger withdrawal restores exact +16`)
  expect(exhaustedRetreat.next.danger.phase, 'calm', `${locale} zero-energy danger withdrawal clears the threat`)

  const calmSave = createInitialSave(cartridge)
  calmSave.stats.energy = 50
  const acceptedRest = resolution(calmSave, cartridge, ordinaryAction)
  const hostileDanger: DangerDirective = {
    phase: 'resolution', severity: 5, threat: locale === 'zh' ? '测试危险' : 'test danger',
    methods: locale === 'zh' ? ['询问', '承担代价', '撤退'] : ['ask', 'pay a cost', 'withdraw'],
    physicalCombat: 'none',
    check: { skill: locale === 'zh' ? '判断' : 'Judgment', dc: 15, roll: 1, modifier: 2, total: 3, outcome: 'critical-failure' },
  }
  const defended = applyParsedScene(calmSave, parseStoryProtocol(acceptedRest.successText, locale), cartridge, ordinaryAction, undefined, undefined, hostileDanger, acceptedRest)
  expect(defended.stats.energy, 58, `${locale} reducer defense prevents danger loss from stacking onto accepted rest`)

  for (let index = 0; index < 60; index += 1) {
    const suffix = String(index + 1).padStart(2, '0')
    const place = locale === 'zh' ? `风铃谷${suffix}` : `Windbell Vale ${suffix}`
    const shelter = locale === 'zh' ? `旧磨坊休息屋${suffix}` : `Old Mill Rest Hut ${suffix}`
    const action = locale === 'zh' ? `走进${shelter}休息一会儿` : `Rest for a while inside ${shelter}`
    const save = createInitialSave(cartridge)
    save.stats.energy = 40
    const raw = locale === 'zh'
      ? `你离开月台，抵达${place}。${shelter}的门开着，里面有干燥长凳。\n[map_update: new_location="${place}" location_id="rest-place-${locale}-${suffix}" connected_to="${cartridge.opening.location}" detail="${shelter}提供不收费的短暂休息" route_hints="${shelter}"]\n[scene_location: location="${shelter}"]\n[choices: "${action}"]`
      : `You leave the platform and arrive at ${place}. The door of ${shelter} is open, with a dry bench inside.\n[map_update: new_location="${place}" location_id="rest-place-${locale}-${suffix}" connected_to="${cartridge.opening.location}" detail="${shelter} offers free short rests" route_hints="${shelter}"]\n[scene_location: location="${shelter}"]\n[choices: "${action}"]`
    const parsed = parseStoryProtocol(raw, locale as Locale)
    const canonical = canonicalizeTurnMetadata(save, parsed, cartridge)
    expect(validateTurnConsistency(save, canonical.parsed, cartridge).length, 0, `${locale} generated rest place ${suffix} validates`)
    const arrived = applyParsedScene(save, canonical.parsed, cartridge, locale === 'zh' ? `前往${place}` : `Travel to ${place}`)
    expect(arrived.choices[0]?.label, action, `${locale} generated contextual rest choice ${suffix} remains visible`)
    const local = resolution(arrived, cartridge, action)
    expect(local.ruleId, 'catch-breath', `${locale} generated rest choice ${suffix} binds to local recovery`)
    const hostile = locale === 'zh'
      ? `你休息后反而更累。\n[widget: energy, remove: 24]\n[map_update: new_location="错误地点"]\n[choices: "凭空出现的工作"]`
      : `You feel more tired after resting.\n[widget: energy, remove: 24]\n[map_update: new_location="Wrong Place"]\n[choices: "An invented job"]`
    const rested = applyParsedScene(arrived, parseStoryProtocol(hostile, locale as Locale), cartridge, action, undefined, undefined, undefined, local)
    expect(rested.stats.energy, 48, `${locale} generated rest choice ${suffix} restores exact energy despite hostile model commands`)
    expect(rested.location, place, `${locale} generated rest choice ${suffix} cannot be hijacked into travel`)
  }
}

console.log(JSON.stringify({ ok: true, simulatedDynamicRestPlaces: 120, assertions, coverage: [
  'nonzero-rest', 'zero-rest', 'contextual-language', 'inquiry-no-consent', 'exact-room-and-morning',
  'companion-and-sublocation-rest', 'danger-block', 'danger-withdrawal', 'no-danger-stacking', 'dynamic-generated-rest', 'hostile-command-isolation', 'zh-en',
] }))
