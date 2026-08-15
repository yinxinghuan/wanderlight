import { strict as assert } from 'node:assert'
import { listCartridges } from '../src/story/cartridges/index'
import { createInitialSave } from '../src/story/engine/reducer'
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

console.log(JSON.stringify({ ok: true, checks: ['replyless-safe-commit', 'unauthorized-spend-blocked', 'underspecified-spend-blocked', 'authored-image-bound'] }))
