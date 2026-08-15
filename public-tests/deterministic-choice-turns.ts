import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { resolveDeterministicChoiceTurn, resolveDeterministicOpeningTurn } from '../src/story/engine/authoredTurns'
import { resolveDomainAction } from '../src/story/engine/domainRules'
import { canonicalizePaymentMetadata, validatePaymentConsistency } from '../src/story/engine/paymentConsistency'
import { applyConsistencyRecovery, applyParsedScene, createInitialSave, restoreDeterministicRecoveryChoice } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { canonicalizeTurnMetadata, validateTurnConsistency } from '../src/story/engine/turnConsistency'
import type { StoryCartridge, StorySave } from '../src/story/types'

function play(save: StorySave, cartridge: StoryCartridge, action: string): StorySave {
  const turn = resolveDeterministicOpeningTurn(save, cartridge, action)
    ?? resolveDeterministicChoiceTurn(save, cartridge, action)
  assert.ok(turn, `${cartridge.locale}: missing deterministic turn for ${action}`)
  let parsed = canonicalizePaymentMetadata(save, parseStoryProtocol(turn.content, cartridge.locale), cartridge, action)
  parsed = canonicalizeTurnMetadata(save, parsed, cartridge, turn.imagePrompt, action, true).parsed
  const violations = [
    ...validatePaymentConsistency(save, parsed, cartridge, action),
    ...validateTurnConsistency(save, parsed, cartridge, turn.imagePrompt),
  ]
  assert.deepEqual(violations, [], `${cartridge.locale}: invalid authored turn for ${action}`)
  return applyParsedScene(save, parsed, cartridge, action, turn.imagePrompt, turn.imageSubject, undefined, undefined, turn.imageCharacterId)
}

const routes = [
  { cartridge: wanderlight, destination: '银叶葡萄丘', coin: 14, actions: ['帮短发女人拦住发光种荚', '帮媛夕把木箱送上月线', '陪媛夕坐到银叶葡萄丘', '坐到媛夕对面的空凳上', '答应清晨和媛夕一起调查葡萄藤'] },
  { cartridge: wanderlightEn, destination: 'Silverleaf Vineyard', coin: 14, actions: ['Help the short-haired woman catch the seed cases', 'Help Mira load the crate onto the Moonline', 'Ride with Mira to Silverleaf Vineyard', 'Sit on the empty stool across from Mira', "Join Mira's dawn vine survey"] },
  { cartridge: wanderlight, destination: '远灯研修院', coin: 21, actions: ['接下乘务员的夜班工作', '帮罗温把泡皱的地图压平', '和罗温把地图送去远灯研修院', '和罗温谈谈那张缺失的海岸线', '请罗温介绍修窑门的工作', '答应明早和罗温检查通往雾杉林的旧支线'] },
  { cartridge: wanderlightEn, destination: 'Far Lantern Institute', coin: 21, actions: ['Take the steward’s vacant night shift', 'Help Rowan flatten the buckled map', 'Deliver the map to Far Lantern Institute with Rowan', 'Ask Rowan about the missing stretch of coast', 'Ask Rowan to introduce the kiln-door job', "Join Rowan's morning inspection of the Mistpine branch"] },
  { cartridge: wanderlight, destination: '潮汐群岛', coin: 13, actions: ['去夜市帮忙搬箱子', '帮塞莱斯特把折叠椅也摆好', '和塞莱斯特去潮汐群岛', '问塞莱斯特那场清晨演出唱给谁听', '帮塞莱斯特试场', '接受塞莱斯特下一站的布台工作'] },
  { cartridge: wanderlightEn, destination: 'Tidal Islands', coin: 13, actions: ['Help move cases at the night market', 'Help Celeste arrange the folding chairs', 'Take the Moonline to the Tidal Islands with Celeste', 'Ask who the dawn concert is for', 'Help Celeste check the dawn performance space', "Take Celeste's staging job at the next market"] },
]

for (const route of routes) {
  let save = createInitialSave(route.cartridge)
  for (const action of route.actions) {
    for (const choice of save.choices) {
      const turn = resolveDeterministicOpeningTurn(save, route.cartridge, choice.label)
        ?? resolveDeterministicChoiceTurn(save, route.cartridge, choice.label)
      const domain = resolveDomainAction(save, route.cartridge, choice.label)
      assert.ok(turn || domain, `${route.cartridge.locale}: displayed authored choice has no execution owner: ${choice.label}`)
      if (turn) {
        const side = play(save, route.cartridge, choice.label)
        for (const nextChoice of side.choices) {
          assert.ok(
            resolveDeterministicChoiceTurn(side, route.cartridge, nextChoice.label)
              || resolveDomainAction(side, route.cartridge, nextChoice.label),
            `${route.cartridge.locale}: deterministic side result exposes an unowned choice: ${nextChoice.label}`,
          )
        }
      }
    }
    save = play(save, route.cartridge, action)
  }
  assert.equal(save.location, route.destination)
  assert.equal(save.stats.coin, route.coin)
  assert.equal(save.sessionEnded, true)
  assert.equal(save.blocks.some((block) => block.id.startsWith('consistency-recovery-')), false)
}

let mira = play(createInitialSave(wanderlight), wanderlight, '帮短发女人拦住发光种荚')
assert.equal(resolveDeterministicChoiceTurn(mira, wanderlight, '我想帮媛夕把木箱送上月线'), undefined, 'free input must remain model-driven')
const noJob = { ...mira, jobs: [] }
assert.equal(resolveDeterministicChoiceTurn(noJob, wanderlight, '帮媛夕把木箱送上月线'), undefined, 'missing job contract must block the authored settlement')

const recovery = applyConsistencyRecovery(mira, wanderlight, '帮媛夕把木箱送上月线')
const restored = restoreDeterministicRecoveryChoice(recovery, wanderlight)
assert.equal(restored.choices[0]?.label, '帮媛夕把木箱送上月线', 'legacy recovery must restore the valid contracted action')
assert.ok(resolveDeterministicChoiceTurn(restored, wanderlight, restored.choices[0]!.label), 'restored recovery action must resolve locally')
mira = play(restored, wanderlight, restored.choices[0]!.label)
assert.equal(mira.location, '月线车厢')
assert.equal(mira.stats.coin, 14)

const rowanOffer = play(createInitialSave(wanderlight), wanderlight, '接下乘务员的夜班工作')
const rowanSideAction = '收好钱币，做完就走'
const rowanRecovery = applyConsistencyRecovery(rowanOffer, wanderlight, rowanSideAction)
const restoredRowanSide = restoreDeterministicRecoveryChoice(rowanRecovery, wanderlight)
assert.equal(restoredRowanSide.choices[0]?.label, rowanSideAction, 'legacy recovery restores a newly governed side choice')
const completedRowanSide = play(restoredRowanSide, wanderlight, rowanSideAction)
assert.equal(completedRowanSide.blocks.some((block) => block.id === `consistency-recovery-${completedRowanSide.scene}`), false)
assert.equal(completedRowanSide.choices.every((choice) => resolveDomainAction(completedRowanSide, wanderlight, choice.label)?.status === 'accepted'), true)

console.log('deterministic choice turn tests passed')
