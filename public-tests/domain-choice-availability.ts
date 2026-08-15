import { strict as assert } from 'node:assert'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { resolveDomainAction } from '../src/story/engine/domainRules'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import type { StorySave } from '../src/story/types'

function act(save: StorySave, action: string): StorySave {
  const resolution = resolveDomainAction(save, wanderlight, action)
  assert.ok(resolution, `missing domain resolution for ${action}`)
  const parsed = parseStoryProtocol(resolution.successText, 'zh')
  return applyParsedScene(save, parsed, wanderlight, action, undefined, undefined, undefined, resolution)
}

let save = createInitialSave(wanderlight)
for (let index = 0; index < 7; index += 1) save = act(save, '找一份短工')
assert.equal(save.stats.energy, 2)
assert.equal(save.choices.some((choice) => choice.label === '找一份短工'), false, 'an unaffordable shift is filtered before display')
assert.ok(save.choices.some((choice) => choice.label === '吃一顿热饭'), 'a feasible recovery remains visible')
assert.ok(save.choices.some((choice) => choice.label === '原地坐下，休息四十五分钟'), 'a free recovery remains visible')
assert.equal(save.choices.every((choice) => resolveDomainAction(save, wanderlight, choice.label)?.status === 'accepted'), true, 'every displayed domain reply is executable now')

save = act(save, '吃一顿热饭')
assert.equal(save.stats.energy, 14)
assert.ok(save.choices.some((choice) => choice.label === '找一份短工'), 'restored energy makes the shift visible again')
assert.equal(save.choices.every((choice) => resolveDomainAction(save, wanderlight, choice.label)?.status === 'accepted'), true)

const poor = { ...createInitialSave(wanderlight), stats: { ...createInitialSave(wanderlight).stats, coin: 2 } }
const rejectedRoom = resolveDomainAction(poor, wanderlight, '住一晚')
assert.equal(rejectedRoom?.status, 'rejected')
assert.ok(rejectedRoom?.reasons.some((reason) => reason.includes('十枚钱币')))

const poorPayment = resolveDomainAction(poor, wanderlight, '支付房费')
assert.equal(poorPayment?.status, 'rejected', '自然语言付款也必须先经过房费余额检查')
assert.equal(resolveDomainAction(poor, wanderlight, '询问旅店房费'), undefined, '询问价格不是订房或付款')

const funded = { ...createInitialSave(wanderlight), stats: { ...createInitialSave(wanderlight).stats, coin: 12 } }
const afterRoom = act(funded, '订一间房')
assert.equal(afterRoom.stats.coin, 2, '明确订房后由领域 reducer 原子扣除十枚钱币')
assert.equal(afterRoom.facts.lodging_secured, true, '付款成功必须持久化已获得住宿')
assert.equal(afterRoom.sessionEnded, true, '过夜住宿应进入已保存的自然停止点')

console.log(JSON.stringify({ ok: true, checks: ['invalid-hidden-before-display', 'feasible-recovery-visible', 'restored-action-returns', 'free-input-specific-reason', 'lodging-payment-preflight', 'lodging-atomic-state'] }))
