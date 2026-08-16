import assert from 'node:assert/strict'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { createInitialSave, applyParsedScene, createRecoveryChoices } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'
import { presetEventRecoveryChoice, resolvePresetEventTurn, selectPresetEvent } from '../src/story/engine/presetEventDirector'
import { chooseSceneImage, shouldUsePlayerImageReference } from '../src/story/engine/imageDirector'
import type { StoryCartridge, StorySave } from '../src/story/types'

function atNode(cartridge: StoryCartridge, nodeId: string): StorySave {
  const save = createInitialSave(cartridge)
  const node = cartridge.initialMap.find((entry) => entry.id === nodeId)
  assert.ok(node, `missing node ${nodeId}`)
  save.location = node.label
  save.sceneLocation = node.label
  save.objective = ''
  save.map = save.map.map((entry) => ({ ...entry, current: entry.id === nodeId, visited: entry.visited || entry.id === nodeId }))
  return save
}

const zhEvents = wanderlight.presetEventDirector?.events ?? []
const enEvents = wanderlightEn.presetEventDirector?.events ?? []
assert.equal(zhEvents.length, 48, '中文必须有 48 个预设地区事件')
assert.equal(enEvents.length, 48, '英文必须有 48 个预设地区事件')
assert.deepEqual(zhEvents.map((event) => event.id), enEvents.map((event) => event.id), '双语事件 ID 与顺序必须一致')
assert.deepEqual(zhEvents.map((event) => event.locationId), enEvents.map((event) => event.locationId), '双语事件地点必须一致')
assert.deepEqual(zhEvents.map((event) => event.category), enEvents.map((event) => event.category), '双语事件类别必须一致')
assert.equal(new Set(zhEvents.map((event) => event.id)).size, 48, '事件 ID 不能重复')
assert.ok(new Set(zhEvents.map((event) => event.category)).size >= 4, '事件池必须覆盖至少四种不同类别')
assert.ok(zhEvents.filter((event) => /FIRST-PERSON PLAYER-EYE VIEW/.test(event.imagePrompt)).length >= 36, '至少四分之三的预设事件候选图采用第一人称')

for (const node of wanderlight.initialMap) {
  const local = zhEvents.filter((event) => event.locationId === node.id)
  assert.equal(local.length, 4, `${node.id} 必须恰有四个预设事件`)
  local.forEach((event) => {
    assert.ok(event.choiceLabel.length >= 4, `${event.id} 需要具体入口行动`)
    assert.ok(event.objective.length >= 4, `${event.id} 需要具体未完目标`)
    assert.ok(event.choices.length >= 2 && event.choices.length <= 5, `${event.id} 需要 2–5 个具体后续行动`)
    assert.ok(!/观察.+新变化|Observe what changed/i.test(event.choiceLabel), `${event.id} 不能使用泛化入口`)
  })
}

for (const cartridge of [wanderlight, wanderlightEn]) {
  for (const node of cartridge.initialMap) {
    let save = atNode(cartridge, node.id)
    const first = selectPresetEvent(save, cartridge)
    const refresh = selectPresetEvent(JSON.parse(JSON.stringify(save)) as StorySave, cartridge)
    assert.equal(first?.id, refresh?.id, `${node.id} 同一存档刷新不能重抽事件`)
    const seen: string[] = []
    for (let turn = 0; turn < 4; turn += 1) {
      const recovery = presetEventRecoveryChoice(save, cartridge)
      assert.ok(recovery, `${node.id} 空闲状态必须给出具体事件行动`)
      save.choices = [recovery]
      const resolution = resolvePresetEventTurn(save, cartridge, recovery.label)
      assert.ok(resolution, `${node.id} 显示的事件行动必须本地可执行`)
      assert.ok(!seen.includes(resolution.eventId), `${node.id} 同一天四个事件耗尽前不能重复`)
      seen.push(resolution.eventId)
      const parsed = parseStoryProtocol(resolution.turn.content, cartridge.locale)
      const prepared = prepareTurnCandidate({
        save,
        parsed,
        cartridge,
        action: recovery.label,
        imagePrompt: resolution.turn.imagePrompt,
        trustedAuthored: true,
      })
      assert.deepEqual(prepared.violations, [], `${resolution.eventId} 必须通过完整回合一致性校验`)
      save = applyParsedScene(
        save, prepared.parsed, cartridge, recovery.label,
        resolution.turn.imagePrompt, resolution.turn.imageSubject,
        undefined, undefined, resolution.turn.imageCharacterId, resolution,
      )
      assert.equal(save.facts[`preset_event:count:${resolution.eventId}`], 1, `${resolution.eventId} 必须持久化一次`)
      assert.equal(save.facts['preset_event:last'], resolution.eventId, `${resolution.eventId} 必须成为最近事件`)
      assert.ok(save.choices.length >= 2, `${resolution.eventId} 结算后必须保留可执行选项`)
      const image = [...save.blocks].reverse().find((block) => block.kind === 'image')
      assert.ok(image, `${resolution.eventId} 必须形成事件图决策`)
      if (/FIRST-PERSON PLAYER-EYE VIEW/.test(resolution.turn.imagePrompt ?? '')) {
        assert.equal(image?.data?.perspective, 'first-person', `${resolution.eventId} 必须记录第一人称视角`)
        assert.equal(image?.data?.playerVisible, 'false', `${resolution.eventId} 第一人称不能把主角画进画面`)
        assert.equal(shouldUsePlayerImageReference(String(image?.data?.prompt ?? '')), false, `${resolution.eventId} 第一人称不能引用玩家头像`)
      }
      save.objective = ''
    }
    const fifth = selectPresetEvent(save, cartridge)
    assert.ok(fifth, `${node.id} 事件池耗尽后仍可继续轮换`)
    assert.notEqual(fifth?.id, seen[seen.length - 1], `${node.id} 事件池轮换不能立即重复最近事件`)
  }
}

const busy = atNode(wanderlight, 'lantern-quay')
busy.objective = '把正在漏水的货箱交给码头保管员'
assert.deepEqual(createRecoveryChoices(busy, wanderlight).map((choice) => choice.label), ['把正在漏水的货箱交给码头保管员'], '明确未完目标必须压住随机事件兜底')
const pendingReply = atNode(wanderlight, 'lantern-quay')
pendingReply.decisionContext = '码头保管员还没有回答木箱应该送到哪一间仓房'
assert.equal(presetEventRecoveryChoice(pendingReply, wanderlight), undefined, '等待现场回应时不能推荐随机事件')
const activeJob = atNode(wanderlight, 'lantern-quay')
activeJob.jobs.push({ id: 'qa-open-job', label: '把漏水货箱送进仓房', wage: 8, status: 'accepted', offeredAtScene: 0 })
assert.equal(presetEventRecoveryChoice(activeJob, wanderlight), undefined, '未完成工作合同时不能推荐随机事件')
const warning = atNode(wanderlight, 'lantern-quay')
warning.danger = { ...warning.danger, phase: 'warning', currentThreat: '码头闸门正在松动' }
assert.equal(selectPresetEvent(warning, wanderlight), undefined, '活动危险期间不能选择普通随机事件')
assert.equal(resolvePresetEventTurn(warning, wanderlight, '看看周围有什么新鲜事'), undefined, '活动危险期间自由输入也不能插入普通随机事件')

const explicit = atNode(wanderlight, 'lantern-quay')
explicit.objective = '以后再处理的长期目标'
assert.ok(resolvePresetEventTurn(explicit, wanderlight, '看看周围有什么新鲜事'), '玩家主动查看当地动静可以进入预设事件')

const dialogueBefore = createInitialSave(wanderlight)
const dialogueParsed = parseStoryProtocol(`媛夕把声音压低，指向雨棚外不断靠近的脚步。\n[媛夕] [main] [担心]: "他们不是来找货的。别站在门口，我需要你现在相信我。"\n[dialogue_focus: speaker="媛夕" expression="眉心收紧，目光越过玩家看向门外"]\n[scene_location: location="灯湾码头"]\n[choices: "和媛夕退到货箱后面"]`, 'zh')
const dialogueNext = { ...dialogueBefore, scene: dialogueBefore.scene + 1 }
const dialogueImage = chooseSceneImage(dialogueBefore, dialogueNext, dialogueParsed, wanderlight)
assert.equal(dialogueImage.reason, 'character-expression', '重要对白仍必须触发表情图')
assert.equal(dialogueImage.perspective, 'first-person', '重要对白默认从主角第一人称看向说话者')
assert.equal(dialogueImage.playerVisible, false, '重要对白第一人称不能把主角画进画面')
assert.equal(shouldUsePlayerImageReference(dialogueImage.prompt ?? ''), false, '重要对白第一人称不传玩家头像')

console.log('preset events: 48 bilingual events, deterministic rotation, persistence, continuity priority, and first-person image ownership passed')
