import { strict as assert } from 'node:assert'
import { listCartridges } from '../src/story/cartridges/index'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'

const cartridge = listCartridges('zh')[0]
const save = createInitialSave(cartridge)

const inquiry = prepareTurnCandidate({
  save,
  cartridge,
  action: '先问清房价，但不要付款',
  parsed: parseStoryProtocol(`旅店招待告诉你房费是十枚钱币。你只了解情况，没有付款。
[scene_location: location="灯湾码头"]`, 'zh'),
})
assert.deepEqual(inquiry.paymentViolations, [])
assert.deepEqual(inquiry.turnViolations, ['turn.requires_actionable_choices'])
assert.equal(inquiry.canCommitWithoutReplies, true)

const unauthorized = prepareTurnCandidate({
  save,
  cartridge,
  action: '先问清房价，但不要付款',
  parsed: parseStoryProtocol(`你支付十枚钱币订下房间。
[widget: coin, remove: 10]
[scene_location: location="灯湾码头"]`, 'zh'),
})
assert.ok(unauthorized.paymentViolations.includes('payment.purchase_requires_player_authorization'))
assert.equal(unauthorized.canCommitWithoutReplies, false)

const underspecifiedSpend = prepareTurnCandidate({
  save,
  cartridge,
  action: '把钱全部花完',
  parsed: parseStoryProtocol(`你用一枚钱币支付了码头旅店的房费。
[widget: coin, remove: 1]
[scene_location: location="灯湾码头"]`, 'zh'),
})
assert.ok(underspecifiedSpend.paymentViolations.includes('payment.purchase_requires_player_authorization'))
assert.equal(underspecifiedSpend.canCommitWithoutReplies, false)

const authored = prepareTurnCandidate({
  save,
  cartridge,
  action: save.choices[0].label,
  imagePrompt: 'authored image prompt',
  trustedAuthored: true,
  parsed: parseStoryProtocol(`你仍在灯湾码头。
[scene_location: location="灯湾码头"]
[choices: "去夜市帮忙搬箱子"]`, 'zh'),
})
assert.equal(authored.discardedImage, false)
assert.equal(authored.imagePrompt, 'authored image prompt')
assert.deepEqual(authored.violations, [])

const vineyard = {
  ...save,
  scene: 8,
  location: '银叶葡萄丘',
  sceneLocation: '银叶葡萄丘的藤架下',
  objective: '跟随巡逻员检查葡萄丘的藤架风险',
  choices: [{ id: '8-0', label: '和同伴一起收拾工具' }],
  map: save.map.map((node) => ({ ...node, current: false })).concat({
    id: 'silver-vineyard', label: '银叶葡萄丘', current: true, visited: true,
  }),
}
const vineyardReplyless = applyParsedScene(vineyard, parseStoryProtocol(`你们正准备收拾工具，突然远处传来巡逻员急促而严肃的呼喊声。
[scene_location: location="银叶葡萄丘的藤架下"]`, 'zh'), cartridge, '和同伴一起收拾工具')
assert.ok(vineyardReplyless.choices.length >= 1, 'a single selected choice cannot leave an ongoing scene with an empty tray')
assert.ok(!vineyardReplyless.choices.some((choice) => choice.label === '和同伴一起收拾工具'), 'the completed choice is not re-offered as fallback')
assert.ok(vineyardReplyless.blocks.some((block) => block.id === `choices-${vineyardReplyless.scene}`), 'state-derived fallback choices are archived with the scene')

const destination = cartridge.initialMap.find((node) => node.label !== save.location)!
const movedReplyless = applyParsedScene(save, parseStoryProtocol(`你搭上月线离开灯湾码头。车门再次打开时，你已经抵达${destination.label}。
[map_update: location="${destination.label}"]
[scene_location: location="${destination.label}"]`, 'zh'), cartridge, save.choices[0].label)
assert.equal(movedReplyless.location, destination.label, 'replyless transition commits the authoritative new map node')
assert.ok(movedReplyless.choices.length >= 1, 'a replyless map transition derives exits from the destination instead of returning an empty tray')
assert.deepEqual(movedReplyless.choices.map((choice) => choice.label), [save.objective.replace(/[。.!！?？；;]+$/u, '')], 'replyless transition keeps the unresolved objective instead of adding a generic location detour')

let continuityRuns = 0
for (const locale of ['zh', 'en'] as const) {
  const localizedCartridge = listCartridges(locale)[0]
  const localizedSave = createInitialSave(localizedCartridge)
  for (const selected of localizedSave.choices) {
    const single = { ...localizedSave, choices: [{ ...selected }] }
    const replyless = applyParsedScene(single, parseStoryProtocol(`${locale === 'zh' ? '眼前的行动已经完成，周围出现了新的动静。' : 'The immediate action is complete, and something changes nearby.'}
[scene_location: location="${single.location}"]`, locale), localizedCartridge, selected.label)
    assert.ok(replyless.choices.length >= 1, `${locale} sole-choice replyless run remains playable`)
    assert.ok(!replyless.choices.some((choice) => choice.label === selected.label), `${locale} completed sole choice is not repeated`)
    continuityRuns += 1
  }
  for (const target of localizedCartridge.initialMap.filter((node) => node.label !== localizedSave.location)) {
    const transitioned = applyParsedScene(localizedSave, parseStoryProtocol(`${locale === 'zh' ? `你已经抵达${target.label}。` : `You arrive at ${target.label}.`}
[map_update: location="${target.label}"]
    [scene_location: location="${target.label}"]`, locale), localizedCartridge, localizedSave.choices[0].label)
    assert.ok(transitioned.choices.length >= 1, `${locale} transition to ${target.label} remains playable`)
    assert.deepEqual(transitioned.choices.map((choice) => choice.label), [localizedSave.objective.replace(/[。.!！?？；;]+$/u, '')], `${locale} transition fallback keeps the unresolved objective`)
    continuityRuns += 1
  }
}
assert.ok(continuityRuns >= 16, 'replyless continuity matrix exercises both locales and every map destination')

console.log(JSON.stringify({ ok: true, continuityRuns, checks: ['replyless-safe-commit', 'unauthorized-spend-blocked', 'underspecified-spend-blocked', 'authored-image-bound', 'single-choice-replyless-fallback', 'transition-replyless-fallback', 'bilingual-map-continuity-matrix'] }))
