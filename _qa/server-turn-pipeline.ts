import assert from 'node:assert/strict'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { executeStoryTurn } from '../src/story/engine/executeTurn'
import { createInitialSave } from '../src/story/engine/reducer'

const initial = createInitialSave(wanderlight)
const initialJson = JSON.stringify(initial)
let domainModelCalls = 0
const rested = await executeStoryTurn({
  save: initial,
  cartridge: wanderlight,
  action: '休息',
  generator: { async send(): Promise<never> { domainModelCalls += 1; throw new Error('MODEL_MUST_NOT_RUN') } },
})
assert.equal(rested.source, 'domain')
assert.equal(domainModelCalls, 0)
assert.equal(rested.save.scene, initial.scene + 1)
assert.equal(rested.save.stats.energy, initial.stats.energy + 8)
assert.equal(rested.save.facts.exhaustion_recoveries, 1)
assert.equal(JSON.stringify(initial), initialJson, 'server pipeline must not mutate its input snapshot')

let modelCalls = 0
const model = await executeStoryTurn({
  save: initial,
  cartridge: wanderlight,
  action: '查看月线通行册封面的水痕',
  generator: {
    async send() {
      modelCalls += 1
      return {
        content: [
          '你把月线通行册移到月台灯下，布封面的水痕围着一枚银色印章形成半圆。乘务员确认这道痕迹来自刚停靠的沿海渡船。',
          '[state: value="确认通行册水痕与沿海渡船的关系"]',
          '[scene_location: location="灯湾码头"]',
          '[choices: "请乘务员核对通行册的签发批次"|"沿月台寻找相同的渡船水痕"]',
        ].join('\n'),
      }
    },
  },
})
assert.equal(model.source, 'model')
assert.equal(modelCalls, 1)
assert.equal(model.save.scene, initial.scene + 1)
assert.equal(model.save.objective, '确认通行册水痕与沿海渡船的关系')
assert.ok(model.save.choices.length >= 1)

let deflectionModelCalls = 0
const threatened = {
  ...initial,
  danger: { ...initial.danger, phase: 'warning' as const, currentThreat: '末班月线突然取消', severity: 3 },
}
const deflected = await executeStoryTurn({
  save: threatened,
  cartridge: wanderlight,
  action: '去夜市看看别的工作',
  generator: { async send(): Promise<never> { deflectionModelCalls += 1; throw new Error('MODEL_MUST_NOT_RUN') } },
})
assert.equal(deflected.source, 'authored')
assert.equal(deflectionModelCalls, 0)
assert.equal(deflected.save.danger.currentThreat, threatened.danger.currentThreat)
assert.deepEqual(deflected.save.stats, threatened.stats)

console.log(JSON.stringify({
  ok: true,
  checks: [
    'server-compatible-pure-turn-pipeline',
    'domain-action-bypasses-model',
    'authoritative-effects-commit-together',
    'input-snapshot-remains-immutable',
    'model-proposal-validates-before-commit',
    'active-danger-deflection-bypasses-model-and-preserves-state',
  ],
}, null, 2))
