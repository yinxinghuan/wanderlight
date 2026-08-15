import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { applyDomainResolution, repairLegacyDomainChoiceReset, resolveDomainAction } from '../src/story/engine/domainRules'
import { encodeChoiceRecord } from '../src/story/engine/choiceInput'
import { applyParsedScene, createChoiceRecordBlock, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import type { Choice, Locale, StoryCartridge, StorySave } from '../src/story/types'

const legacyUtilityLabels = {
  zh: ['接一份九十分钟短工（报酬 9 枚）', '吃一顿热饭', '原地坐下，休息四十五分钟', '放弃当前行动，去最近的公共休息处', '结束今天，休息到清晨'],
  en: ['Take a ninety-minute shift (9 coin)', 'Get something to eat', 'Sit down and rest for forty-five minutes', 'Abandon the current action and reach the nearest public rest area', 'End the day and rest until morning'],
} as const

function carriageSave(cartridge: StoryCartridge): StorySave {
  const zh = cartridge.locale === 'zh'
  const base = createInitialSave(cartridge)
  const choices: Choice[] = (zh
    ? ['继续和媛夕说下一站的安排', '问乘务员还有多久到站', '靠着车窗休息']
    : ['Keep discussing the next stop with Mira', 'Ask the steward how long remains', 'Rest by the window'])
    .map((label, index) => ({ id: `carriage-${index}`, label }))
  const mira = cartridge.characters.find((character) => character.id === 'mira-voss')!
  return {
    ...base,
    scene: 6,
    location: zh ? '月线车厢' : 'Moonline Carriage',
    sceneLocation: zh ? '驶往银叶葡萄丘的月线车厢' : 'Moonline carriage bound for Silverleaf Vineyard',
    objective: zh ? '和媛夕一起抵达银叶葡萄丘。' : 'Reach Silverleaf Vineyard with Mira.',
    decisionContext: zh ? '列车正在行驶，你和媛夕的谈话还没有结束。' : 'The train is moving, and your conversation with Mira is not finished.',
    map: base.map.map((node) => ({ ...node, current: node.id === 'moonline-carriage', visited: node.visited || node.id === 'moonline-carriage' })),
    characters: [{ ...mira, status: 'known', origin: 'cartridge', updatedAtScene: 5, skills: mira.skills.map((skill) => ({ ...skill })) }],
    choices,
    blocks: [
      ...base.blocks,
      { id: 'action-6', kind: 'event', text: zh ? '陪媛夕上车' : 'Board with Mira' },
      { id: 'carriage-thread', kind: 'narration', text: zh ? '列车驶向银叶葡萄丘。媛夕还在等你回答，乘务员从过道走近。' : 'The train heads toward Silverleaf Vineyard. Mira still awaits your answer as the steward approaches.' },
      createChoiceRecordBlock(6, choices),
    ],
  }
}

function applyLocal(save: StorySave, cartridge: StoryCartridge, action: string): StorySave {
  const resolution = resolveDomainAction(save, cartridge, action)
  assert.ok(resolution, `missing local resolution for ${action}`)
  return applyParsedScene(save, parseStoryProtocol(resolution.successText, cartridge.locale), cartridge, action, undefined, undefined, undefined, resolution)
}

for (const cartridge of [wanderlight, wanderlightEn]) {
  const locale = cartridge.locale as Locale
  const zh = locale === 'zh'
  const before = carriageSave(cartridge)
  const rest = zh ? '靠着车窗休息' : 'Rest by the window'
  const after = applyLocal(before, cartridge, rest)

  assert.equal(after.location, before.location, `${locale}: carriage rest keeps map node`)
  assert.equal(after.sceneLocation, before.sceneLocation, `${locale}: carriage rest keeps exact scene`)
  assert.equal(after.objective, before.objective, `${locale}: carriage rest keeps objective`)
  assert.equal(after.decisionContext, before.decisionContext, `${locale}: carriage rest keeps active premise`)
  assert.deepEqual(after.choices.map((choice) => choice.label), before.choices.slice(0, 2).map((choice) => choice.label), `${locale}: carriage rest resumes grounded siblings`)
  assert.equal(after.choices.some((choice) => (legacyUtilityLabels[locale] as readonly string[]).includes(choice.label)), false, `${locale}: no fixed utility menu is injected`)
  assert.equal(after.stats.energy, Math.min(100, before.stats.energy + 8), `${locale}: carriage rest still applies exact energy`)

  for (const action of (zh ? ['找一份短工', '吃一顿热饭', '订一间房'] : ['Look for a short job', 'Get something to eat', 'Book a room'])) {
    const resolution = resolveDomainAction(after, cartridge, action)
    assert.equal(resolution?.status, 'rejected', `${locale}: unavailable carriage action rejected: ${action}`)
    assert.equal(resolution?.effects.length, 0, `${locale}: unavailable carriage action has zero effects: ${action}`)
    const rejected = applyLocal(after, cartridge, action)
    assert.deepEqual(rejected.stats, after.stats, `${locale}: rejected carriage action changes no stats: ${action}`)
    assert.deepEqual(rejected.choices.map((choice) => choice.label), after.choices.map((choice) => choice.label), `${locale}: rejected carriage action preserves thread: ${action}`)
  }

  const quay = createInitialSave(cartridge)
  assert.equal(resolveDomainAction(quay, cartridge, zh ? '找一份短工' : 'Look for a short job')?.status, 'accepted', `${locale}: a location with work capability still accepts a shift`)

  const buggy = carriageSave(cartridge)
  const legacy = legacyUtilityLabels[locale].map((label, index) => ({ id: `legacy-${index}`, label }))
  const action = rest
  const resolution = resolveDomainAction(buggy, cartridge, action)!
  const migratedCandidate: StorySave = {
    ...buggy,
    scene: 7,
    lastActionId: action,
    decisionContext: '',
    choices: legacy,
    blocks: [
      ...buggy.blocks,
      { id: 'action-7', kind: 'event', text: action },
      { id: 'domain-7', kind: 'narration', text: resolution.successText, data: { domainRule: 'carriage-rest', domainStatus: 'accepted' } },
      { id: 'choices-7', kind: 'choices', text: encodeChoiceRecord(legacy), data: { scene: 7 } },
    ],
  }
  const migrated = repairLegacyDomainChoiceReset(migratedCandidate, cartridge)
  assert.deepEqual(migrated.choices.map((choice) => choice.label), buggy.choices.slice(0, 2).map((choice) => choice.label), `${locale}: old fixed-menu save restores previous sibling choices`)
  assert.equal(migrated.blocks.find((block) => block.id === 'choices-7')?.text, encodeChoiceRecord(migrated.choices), `${locale}: old immutable choice record is repaired too`)
  assert.deepEqual(repairLegacyDomainChoiceReset(migrated, cartridge), migrated, `${locale}: migration is idempotent`)

  const direct = { ...carriageSave(cartridge), choices: [] }
  const directResolution = resolveDomainAction(direct, cartridge, rest)!
  const effectOnly = { ...direct, stats: { ...direct.stats }, facts: { ...direct.facts }, choices: [] }
  applyDomainResolution(effectOnly, cartridge, directResolution)
  assert.equal(effectOnly.choices.length, 0, `${locale}: resume resolution never installs a replacement menu directly`)
}

console.log(JSON.stringify({ ok: true, checks: ['carriage-thread-resume', 'no-fixed-menu', 'location-capability-preflight', 'rejection-atomicity', 'legacy-save-repair', 'zh-en'] }))
