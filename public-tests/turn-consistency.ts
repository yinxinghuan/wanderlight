import { listCartridges } from '../src/story/cartridges/index'
import { decodeChoiceRecord, encodeChoiceRecord } from '../src/story/engine/choiceInput'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyConsistencyRecovery, createImageBlock, createInitialSave, repairLegacyConsistencyRecovery } from '../src/story/engine/reducer'
import { upgradePendingSceneImagePrompts } from '../src/story/engine/imageDirector'
import { canonicalizeTurnMetadata, repairKnownForestSceneDivergence, validateTurnConsistency } from '../src/story/engine/turnConsistency'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const cartridge = listCartridges('zh')[0]
const initial = createInitialSave(cartridge)
const screenshotDraft = `你可以感受到她话语中的紧张和责任感，这让你对今晚的任务有了更深的认识。

你准备：

跟随护林人开始巡逻，尽快完成任务

观察周围环境，留意可能的异常动静

询问林薇是否愿意一起制定应对突发状况的计划`
const recovered = parseStoryProtocol(screenshotDraft, 'zh')
const recoveredChoices = recovered.commands.find((command) => command.type === 'choices')
ok(recoveredChoices?.type === 'choices', 'bare choices after 你准备 must be recovered')
equal(recoveredChoices.choices.length, 3, 'all screenshot choices are recovered')
ok(!recovered.blocks.some((block) => /你准备|跟随护林人开始巡逻/.test(block.text)), 'recovered choices are removed from prose')
const screenshotViolations = validateTurnConsistency(initial, recovered, cartridge, 'old quay image prompt')
ok(screenshotViolations.includes('turn.requires_one_scene_location'), 'missing scene location is rejected')
ok(screenshotViolations.includes('image.requires_one_image_location'), 'image without bound location is rejected')
ok(!screenshotViolations.includes('turn.new_task_requires_objective_state'), 'mentioning an existing tonight task is not a new objective')

const explicitNewTask = parseStoryProtocol(`莉莎把货单交给你。你接下了搬运货物的任务。
[scene_location: location="灯湾码头"]
[choices: "搬第一只箱子"|"先检查货单"|"询问搬运路线"]`, 'zh')
ok(validateTurnConsistency(initial, explicitNewTask, cartridge).includes('turn.new_task_requires_objective_state'), 'an explicitly accepted new task still requires objective state')
const canonicalTask = canonicalizeTurnMetadata(initial, explicitNewTask, cartridge, undefined, '答应帮莉莎搬运货物')
equal(validateTurnConsistency(initial, canonicalTask.parsed, cartridge).length, 0, 'a visible accepted task receives a local objective command')
ok(canonicalTask.parsed.commands.some((command) => command.type === 'state' && /搬运货物/.test(command.value)), 'the inferred objective comes from visible task prose')

const missingMetadata = parseStoryProtocol(`莉莎点了点货物旁的空地，让你先决定从哪边动手。
[choices: "从左侧开始搬运"|"检查箱子的绑带"|"询问莉莎摆放顺序"]`, 'zh')
const canonicalMissing = canonicalizeTurnMetadata(initial, missingMetadata, cartridge)
equal(validateTurnConsistency(initial, canonicalMissing.parsed, cartridge).length, 0, 'a missing protocol-only scene location is filled from authoritative state')
ok(canonicalMissing.parsed.commands.some((command) => command.type === 'scene_location' && command.location === initial.location), 'canonical scene location uses authoritative location')
const ordinaryAction = canonicalizeTurnMetadata(initial, missingMetadata, cartridge, undefined, '前往杯影夜市寻找短发女人')
ok(!ordinaryAction.parsed.commands.some((command) => command.type === 'state'), 'an ordinary action cannot silently replace the long-term objective')

const unboundImage = canonicalizeTurnMetadata(initial, missingMetadata, cartridge, 'an unbound scene proposal')
equal(unboundImage.imagePrompt, undefined, 'an image proposal without image_location is discarded')
ok(unboundImage.discardedImage, 'discarded image metadata is reported to the caller')
equal(validateTurnConsistency(initial, unboundImage.parsed, cartridge, unboundImage.imagePrompt).length, 0, 'discarding an unbound image does not reject the story turn')

const playableRecovery = applyConsistencyRecovery(initial, cartridge, '尝试一个未通过一致性校验的行动')
equal(playableRecovery.scene, initial.scene + 1, 'a rejected generated turn becomes one local playable recovery turn')
equal(playableRecovery.location, initial.location, 'consistency recovery cannot change authoritative location')
equal(playableRecovery.stats.coin, initial.stats.coin, 'consistency recovery cannot change authoritative stats')
equal(playableRecovery.choices.length, 3, 'consistency recovery installs grounded actions')
equal(playableRecovery.choices[0]?.label, '尝试一个未通过一致性校验的行动', 'consistency recovery keeps the player intent as the first action')
ok(playableRecovery.blocks.some((block) => block.id === `consistency-recovery-${playableRecovery.scene}` && block.text.includes('尝试一个未通过一致性校验的行动') && block.text.includes(initial.location)), 'consistency recovery explains why the attempted action paused at the current location')
ok(!playableRecovery.choices.some((choice) => choice.label.includes(initial.objective)), 'consistency recovery cannot route through a stale objective')
ok(!playableRecovery.blocks.some((block) => /一致性检查|未写入存档|请重试/.test(block.text)), 'technical validation errors are not exposed to players')

const legacyRecoveryAction = '前往杯影夜市观察夏琳和她的手下'
const legacyRecoveryChoices = [
  { id: 'recovery-6-0', label: '观察灯湾码头的新变化' },
  { id: 'recovery-6-1', label: '追查“询问男子关于短发女人的更多细节”的线索' },
  { id: 'recovery-6-2', label: '换一种方式处理当前局面' },
]
const legacyRecovery = {
  ...initial,
  scene: 6,
  objective: '询问男子关于短发女人的更多细节',
  lastActionId: legacyRecoveryAction,
  blocks: [
    ...initial.blocks,
    { id: 'action-5', kind: 'event' as const, text: '询问男子关于短发女人的更多细节' },
    { id: 'consistency-recovery-5', kind: 'narration' as const, text: '你重新确认了眼前的情况，没有把不确定的消息写进旅途记录。灯湾码头的一切仍在继续。' },
    { id: 'choices-5', kind: 'choices' as const, text: encodeChoiceRecord(legacyRecoveryChoices) },
    { id: 'action-6', kind: 'event' as const, text: legacyRecoveryAction },
    { id: 'consistency-recovery-6', kind: 'narration' as const, text: '你重新确认了眼前的情况，没有把不确定的消息写进旅途记录。灯湾码头的一切仍在继续。' },
    { id: 'choices-6', kind: 'choices' as const, text: encodeChoiceRecord(legacyRecoveryChoices) },
  ],
  choices: legacyRecoveryChoices,
}
const repairedRecovery = repairLegacyConsistencyRecovery(legacyRecovery, cartridge)
equal(repairedRecovery.choices[0]?.label, legacyRecoveryAction, 'a saved legacy recovery returns to the exact attempted route')
ok(repairedRecovery.blocks.find((block) => block.id === 'consistency-recovery-6')?.text.includes(legacyRecoveryAction), 'a saved legacy recovery gains an action-specific explanation')
equal(decodeChoiceRecord(repairedRecovery.blocks.find((block) => block.id === 'choices-6')?.text ?? '')[0], legacyRecoveryAction, 'saved article and tray choices migrate together')
equal(decodeChoiceRecord(repairedRecovery.blocks.find((block) => block.id === 'choices-5')?.text ?? '')[0], '询问男子关于短发女人的更多细节', 'earlier visible recovery choices migrate with the latest turn')
equal(repairedRecovery.objective, legacyRecoveryAction, 'an objective polluted by the old action fallback is realigned to the latest intent')
equal(repairLegacyConsistencyRecovery(repairedRecovery, cartridge).choices[0]?.label, legacyRecoveryAction, 'legacy recovery migration is idempotent')

const valid = parseStoryProtocol(`你先回到月线车厢。列车停稳后，你在雾杉林下车，护林人林薇请你参加今晚的巡逻任务。
[map_update: new_location="雾杉林" connected_to="月线车厢" detail="夜间巡逻开始前的林灯栈道"]
[scene_location: location="雾杉林"]
[state: value="跟随护林人完成今晚的巡逻任务"]
[choices: "跟随护林人开始巡逻"|"观察雾杉林栈道的异常动静"|"询问林薇如何应对突发状况"]
[image_location: location="雾杉林"]`, 'zh')
equal(validateTurnConsistency(initial, valid, cartridge, 'Mistpine Forest ranger patrol at night').length, 0, 'valid aligned turn')

const stale = parseStoryProtocol(`你在雾杉林的林灯下停步。
[map_update: new_location="雾杉林" connected_to="月线车厢"]
[scene_location: location="雾杉林"]
[choices: "观察灯湾码头的新变化"|"跟随护林人巡逻"|"询问林薇今晚的路线"]`, 'zh')
ok(validateTurnConsistency(initial, stale, cartridge).includes('choices.cannot_act_in_stale_location'), 'an action located in the old scene is rejected')

const legacyChoices = [
  { id: 'old-0', label: '观察灯湾码头的新变化' },
  { id: 'old-1', label: '追查“在末班月线离站前挣到今晚的房钱。”的线索' },
  { id: 'old-2', label: '换一种方式处理当前局面' },
]
const legacy = {
  ...initial,
  scene: 4,
  blocks: [
    ...initial.blocks,
    { id: 'line-a', kind: 'narration' as const, text: '你准备：' },
    { id: 'line-b', kind: 'narration' as const, text: '跟随护林人开始巡逻，尽快完成任务' },
    { id: 'line-c', kind: 'narration' as const, text: '观察周围环境，留意可能的异常动静' },
    { id: 'line-d', kind: 'narration' as const, text: '询问林薇是否愿意一起制定应对突发状况的计划' },
    createImageBlock('image-4', '灯湾码头', 'old quay prompt', 'ready', 'https://example.com/old.webp'),
    { id: 'choices-4', kind: 'choices' as const, text: JSON.stringify(legacyChoices.map((choice) => choice.label)) },
  ],
  choices: legacyChoices,
}
const repaired = repairKnownForestSceneDivergence(legacy, cartridge)
equal(repaired.location, '雾杉林', 'known screenshot save is moved to its visible scene')
equal(repaired.choices[0].label, '跟随护林人开始巡逻，尽快完成任务', 'known screenshot choices replace stale recovery choices')
equal(decodeChoiceRecord(repaired.blocks.find((block) => block.id === 'choices-4')?.text ?? '')[0], repaired.choices[0].label, 'article and tray choices remain one source')
const repairedImage = repaired.blocks.find((block) => block.id === 'image-4')
equal(repairedImage?.text, '雾杉林', 'known screenshot image is rebound to the visible location')
equal(repairedImage?.data?.status, 'queued', 'known screenshot image is queued for regeneration')
equal(repairedImage?.data?.url, '', 'known screenshot old image URL is removed')
const upgraded = upgradePendingSceneImagePrompts(repaired, cartridge)
const upgradedImage = upgraded.blocks.find((block) => block.id === 'image-4')
ok(String(upgradedImage?.data?.prompt ?? '').includes('雾杉林'), 'regenerated prompt is rebuilt from the repaired location')
ok(!String(upgradedImage?.data?.prompt ?? '').includes('old quay prompt'), 'old location prompt cannot survive migration')
equal(repairKnownForestSceneDivergence(repaired, cartridge).location, '雾杉林', 'known screenshot migration is idempotent')

console.log(JSON.stringify({ ok: true, checks: ['bare-choice-recovery', 'scene-location-required', 'image-location-required', 'existing-task-not-misread', 'explicit-objective-required', 'objective-canonicalized', 'scene-location-canonicalized', 'ordinary-action-not-objective', 'unbound-image-discarded', 'action-aligned-consistency-recovery', 'legacy-recovery-repaired', 'stale-place-choice-rejected', 'known-save-repaired', 'old-image-prompt-removed'] }))
