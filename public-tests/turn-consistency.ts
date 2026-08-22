import { listCartridges } from '../src/story/cartridges/index'
import { decodeChoiceRecord, encodeChoiceRecord } from '../src/story/engine/choiceInput'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyConsistencyRecovery, applyConsistencyRecoverySelection, applyDisplayedRouteFallback, applyParsedScene, createImageBlock, createInitialSave, repairLegacyConsistencyRecovery, resolveConsistencyRecoverySelection, restoreDeterministicRecoveryChoice } from '../src/story/engine/reducer'
import { upgradePendingSceneImagePrompts } from '../src/story/engine/imageDirector'
import { canCommitDisplayedChoiceWithoutGeneratedReplies, canCommitGeneratedTurnWithoutReplies, canonicalizeTurnMetadata, inferActionDestination, repairKnownForestSceneDivergence, validateTurnConsistency } from '../src/story/engine/turnConsistency'
import { canonicalizePaymentMetadata, validatePaymentConsistency } from '../src/story/engine/paymentConsistency'
import { resolveDeterministicOpeningTurn } from '../src/story/engine/authoredTurns'
import { t } from '../src/story/i18n'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }
function createLoopChoices(scene: number, first: string, second: string) {
  return [
    { id: `recovery-${scene}-0`, label: first },
    { id: `recovery-${scene}-1`, label: second },
    { id: `recovery-${scene}-2`, label: '暂缓这一步，留在灯湾码头观察局势' },
  ]
}

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
const candidateObjectiveChoice = canonicalizeTurnMetadata(initial, parseStoryProtocol(`你接受的新任务是守望月桥。
[scene_location: location="${initial.location}"]
[state: value="守望月桥"]
[choices: "查看守望月桥"]`, 'zh'), cartridge)
const candidateObjectiveChoices = candidateObjectiveChoice.parsed.commands.find((command) => command.type === 'choices')
ok(candidateObjectiveChoices?.type === 'choices' && candidateObjectiveChoices.choices.length === 1, 'choice grounding uses the same-turn candidate objective')

const missingMetadata = parseStoryProtocol(`莉莎检查了箱子的绑带，指向左侧空地，并说明稍后会告诉你摆放顺序。
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

const failedRecommendation = initial.choices[0].label
const playableRecovery = applyConsistencyRecovery(initial, cartridge, failedRecommendation)
equal(playableRecovery.scene, initial.scene + 1, 'a rejected generated turn becomes one local playable recovery turn')
equal(playableRecovery.location, initial.location, 'consistency recovery cannot change authoritative location')
equal(playableRecovery.stats.coin, initial.stats.coin, 'consistency recovery cannot change authoritative stats')
equal(playableRecovery.choices.length, initial.choices.length - 1, 'consistency recovery preserves only trustworthy sibling recommendations')
ok(!playableRecovery.choices.some((choice) => choice.label === failedRecommendation), 'a failed generated action is quarantined instead of re-offered')
ok(playableRecovery.blocks.some((block) => block.id === `consistency-recovery-${playableRecovery.scene}` && block.text.includes(initial.location)), 'consistency recovery explains the safe pause at the current location')
ok(!playableRecovery.choices.some((choice) => choice.label.includes(initial.objective)), 'consistency recovery cannot route through a stale objective')
ok(!playableRecovery.blocks.some((block) => /一致性检查|未写入存档|请重试/.test(block.text)), 'technical validation errors are not exposed to players')

const secondFailedRecommendation = playableRecovery.choices[0].label
const nestedRecovery = applyConsistencyRecovery(playableRecovery, cartridge, secondFailedRecommendation)
ok(!nestedRecovery.choices.some((choice) => choice.label === failedRecommendation || choice.label === secondFailedRecommendation), 'a repeated consistency failure cannot re-offer either failed action')
equal(nestedRecovery.choices.length, playableRecovery.choices.length - 1, 'a repeated failure strictly shrinks the recommendation set')

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
ok(!repairedRecovery.choices.some((choice) => choice.label === legacyRecoveryAction), 'a saved legacy recovery removes the previously failed route from quick replies')
ok(repairedRecovery.blocks.find((block) => block.id === 'consistency-recovery-6')?.text.includes(initial.location), 'a saved legacy recovery gains a current-location explanation without promoting the failed action')
equal(decodeChoiceRecord(repairedRecovery.blocks.find((block) => block.id === 'choices-6')?.text ?? '').length, repairedRecovery.choices.length, 'saved article and tray choices migrate together even when free input is the only escape')
equal(repairedRecovery.choices.length, 0, 'legacy recovery with no trustworthy pre-failure siblings leaves the quick tray empty')
equal(repairedRecovery.objective, legacyRecoveryAction, 'an objective polluted by the old action fallback is realigned to the latest intent')
equal(repairLegacyConsistencyRecovery(repairedRecovery, cartridge).choices.length, repairedRecovery.choices.length, 'legacy recovery migration is idempotent')

const screenshotOriginalAction = '留在码头接受搬运工作'
const screenshotConfirmAction = '先在灯湾码头确认与这一步有关的路线和线索'
const screenshotLoop = {
  ...initial,
  scene: 2,
  lastActionId: screenshotConfirmAction,
  blocks: [
    ...initial.blocks,
    { id: 'action-1', kind: 'event' as const, text: screenshotOriginalAction },
    { id: 'consistency-recovery-1', kind: 'narration' as const, text: t(cartridge.locale, 'consistencyRecovery', { name: initial.location, action: screenshotOriginalAction }) },
    { id: 'choices-1', kind: 'choices' as const, text: encodeChoiceRecord(createLoopChoices(1, screenshotOriginalAction, screenshotConfirmAction)) },
    { id: 'action-2', kind: 'event' as const, text: screenshotConfirmAction },
    { id: 'consistency-recovery-2', kind: 'narration' as const, text: t(cartridge.locale, 'consistencyRecovery', { name: initial.location, action: screenshotConfirmAction }) },
    { id: 'choices-2', kind: 'choices' as const, text: encodeChoiceRecord(createLoopChoices(2, screenshotConfirmAction, screenshotConfirmAction)) },
  ],
  choices: createLoopChoices(2, screenshotConfirmAction, screenshotConfirmAction),
}
const repairedScreenshotLoop = repairLegacyConsistencyRecovery(screenshotLoop, cartridge)
ok(!repairedScreenshotLoop.choices.some((choice) => choice.label === screenshotOriginalAction || choice.label === screenshotConfirmAction), 'the shipped duplicate recovery save removes both looping actions')
equal(repairedScreenshotLoop.choices.length, 0, 'the shipped duplicate recovery save uses free input instead of manufacturing another local menu')

const valid = parseStoryProtocol(`你先回到月线车厢。列车停稳后，你在雾杉林下车，护林人林薇请你参加今晚的巡逻任务。
[map_update: new_location="雾杉林" connected_to="月线车厢" detail="夜间巡逻开始前的林灯栈道"]
[scene_location: location="雾杉林"]
[state: value="跟随护林人完成今晚的巡逻任务"]
[choices: "跟随护林人开始巡逻"|"观察雾杉林栈道的异常动静"|"询问林薇如何应对突发状况"]
[image_location: location="雾杉林"]`, 'zh')
equal(validateTurnConsistency(initial, valid, cartridge, 'Mistpine Forest ranger patrol at night').length, 0, 'valid aligned turn')

const stale = parseStoryProtocol(`你在雾杉林的林灯下停步，护林人林薇请你选择今晚的巡逻方式。
[map_update: new_location="雾杉林" connected_to="月线车厢"]
[scene_location: location="雾杉林"]
[choices: "观察灯湾码头的新变化"|"跟随护林人巡逻"|"询问林薇今晚的路线"]`, 'zh')
ok(validateTurnConsistency(initial, stale, cartridge).includes('choices.cannot_act_in_stale_location'), 'an action located in the old scene is rejected')
const filteredStale = canonicalizeTurnMetadata(initial, stale, cartridge)
const filteredStaleChoices = filteredStale.parsed.commands.find((command) => command.type === 'choices')
ok(filteredStaleChoices?.type === 'choices', 'mixed choice set remains actionable after filtering')
equal(filteredStaleChoices.choices.length, 2, 'only the impossible old-location choice is removed')
ok(!filteredStaleChoices.choices.some((choice) => choice.includes('灯湾码头')), 'known dead-end choice never reaches the tray')
equal(validateTurnConsistency(initial, filteredStale.parsed, cartridge).length, 0, 'remaining valid choices commit without forcing a three-choice quota')

const hiddenNoun = parseStoryProtocol(`你在灯湾码头查看当前航班和码头时刻表。
[scene_location: location="灯湾码头"]
[choices: "继续查看当前航班"|"询问尚未登场的森林王后"|"留在原地等待"|"检查码头时刻表"]`, 'zh')
const filteredHiddenNoun = canonicalizeTurnMetadata(initial, hiddenNoun, cartridge)
const hiddenNounChoices = filteredHiddenNoun.parsed.commands.find((command) => command.type === 'choices')
ok(hiddenNounChoices?.type === 'choices', 'grounded subset remains available')
equal(hiddenNounChoices.choices.length, 3, 'one unintroduced-noun dead end is filtered from a four-choice set')
ok(!hiddenNounChoices.choices.some((choice) => choice.includes('森林王后')), 'an unintroduced character cannot survive choice filtering')

const partialOverlap = parseStoryProtocol(`码头边有人正在搬箱子，也有人招呼你来帮忙。
[scene_location: location="灯湾码头"]
[choices: "接受帮忙整理温室和搬运材料"|"帮忙搬码头边的箱子"]`, 'zh')
const filteredPartialOverlap = canonicalizeTurnMetadata(initial, partialOverlap, cartridge)
const partialChoices = filteredPartialOverlap.parsed.commands.find((command) => command.type === 'choices')
ok(partialChoices?.type === 'choices', 'a strong grounded choice survives partial-overlap filtering')
equal(partialChoices.choices.length, 1, 'a generic overlapping word cannot validate unknown objects')
equal(partialChoices.choices[0], '帮忙搬码头边的箱子', 'the current-scene action remains')

const rowanDefinition = cartridge.characters.find((character) => character.id === 'rowan-hale')!
const semanticSave = {
  ...initial,
  location: '远灯研修院',
  characters: [{ ...rowanDefinition, status: 'known' as const, origin: 'cartridge' as const, updatedAtScene: 1 }],
  map: initial.map.map((node) => ({ ...node, current: node.id === 'far-lantern-institute', visited: node.id === 'far-lantern-institute' ? true : node.visited })),
}
const semanticQualifiers = parseStoryProtocol(`罗温放下地图。广播刚刚确认末班月线取消；你们仍在远灯研修院等待后续通知。
[scene_location: location="远灯研修院"]
[choices: "询问罗温关于末班月线取消的具体情况"|"决定留在远灯研修院，等待进一步消息"|"前往从未出现的霜港寻找伊芙"]`, 'zh')
const semanticCanonical = canonicalizeTurnMetadata(semanticSave, semanticQualifiers, cartridge)
const semanticChoices = semanticCanonical.parsed.commands.find((command) => command.type === 'choices')
ok(semanticChoices?.type === 'choices', 'semantic qualifier fixture keeps a choice command')
equal(semanticChoices.choices.length, 2, 'abstract Chinese qualifiers do not erase established people, events and places')
ok(!semanticChoices.choices.some((choice) => choice.includes('霜港') || choice.includes('伊芙')), 'unknown named entities remain filtered')

const sublocation = canonicalizeTurnMetadata(semanticSave, parseStoryProtocol(`你和罗温走进远灯研修院工坊，仍在研修院范围内。
[scene_location: location="远灯研修院工坊"]
[choices: "留在远灯研修院等待"]`, 'zh'), cartridge)
ok(sublocation.parsed.commands.some((command) => command.type === 'scene_location' && command.location === '远灯研修院工坊'), 'a named sublocation remains distinct from its authoritative map node')
equal(validateTurnConsistency(semanticSave, sublocation.parsed, cartridge).length, 0, 'a current-node sublocation cannot create a false teleport recovery')

const locallyExecutable = parseStoryProtocol(`灯湾码头的公开设施仍在运转。
[scene_location: location="灯湾码头"]
[choices: "找一份短工"|"吃一顿热饭"|"原地坐下，休息四十五分钟"]`, 'zh')
const executableCanonical = canonicalizeTurnMetadata(initial, locallyExecutable, cartridge)
const executableChoices = executableCanonical.parsed.commands.find((command) => command.type === 'choices')
ok(executableChoices?.type === 'choices', 'locally executable choices keep their command')
equal(executableChoices.choices.length, 3, 'accepted domain actions survive without brittle prose repetition')

const omittedMapUpdate = parseStoryProtocol(`你穿过雨棚，走进杯影夜市。舞台旁的木箱已经搬到干燥处。
[scene_location: location="杯影夜市"]
[choices: "检查舞台旁的木箱"|"留在杯影夜市等待"]`, 'zh')
const canonicalArrival = canonicalizeTurnMetadata(initial, omittedMapUpdate, cartridge)
ok(canonicalArrival.parsed.commands.some((command) => command.type === 'map_update' && command.location === '杯影夜市'), 'visible arrival at a known place synthesizes the omitted map update')
equal(validateTurnConsistency(initial, canonicalArrival.parsed, cartridge).length, 0, 'known visible arrival commits without blaming the player for missing model metadata')

const carriageNode = cartridge.initialMap.find((node) => node.id === 'moonline-carriage')!
const carriageSave = {
  ...initial,
  location: carriageNode.label,
  sceneLocation: carriageNode.label,
  map: initial.map.map((node) => ({ ...node, current: node.id === carriageNode.id })),
}
const vineyardAction = '接受媛夕的分工安排，和临时工一起往田野深处检查藤架'
equal(inferActionDestination(carriageSave, cartridge, vineyardAction)?.id, 'silverleaf-vineyard', 'field and trellis semantics resolve the displayed route to Silverleaf Vineyard')
const semanticFieldDraft = parseStoryProtocol(`你和临时工已经在田野深处开始干活。泥土粘在靴子上，你们逐排检查葡萄藤架。
[scene_location: location="月线车厢"]
[choices: "观察银叶葡萄丘的新变化"]`, 'zh')
const semanticField = canonicalizeTurnMetadata(carriageSave, semanticFieldDraft, cartridge, undefined, vineyardAction)
ok(semanticField.parsed.commands.some((command) => command.type === 'map_update' && command.location === '银叶葡萄丘'), 'a displayed semantic route synthesizes its stable destination update')
ok(semanticField.parsed.commands.some((command) => command.type === 'scene_location' && command.location !== '月线车厢'), 'stale carriage scene metadata is replaced when the route reaches the field')
equal(validateTurnConsistency(carriageSave, semanticField.parsed, cartridge, undefined, vineyardAction).length, 0, 'field prose, map state and system route commit as one aligned turn')
const semanticFieldCommitted = applyParsedScene(carriageSave, semanticField.parsed, cartridge, vineyardAction)
equal(semanticFieldCommitted.location, '银叶葡萄丘', 'the HUD location follows the field action')

const contradictoryField = canonicalizeTurnMetadata(carriageSave, parseStoryProtocol(`你开始行动，但没有顺利衔接。你仍在月线车厢。
[scene_location: location="月线车厢"]
[choices: "查看月线车厢现在能做的事"]`, 'zh'), cartridge, undefined, vineyardAction)
ok(!contradictoryField.parsed.commands.some((command) => command.type === 'map_update'), 'an explicit claim that the player remains in the carriage is not silently rewritten as arrival')
ok(validateTurnConsistency(carriageSave, contradictoryField.parsed, cartridge, undefined, vineyardAction).includes('turn.displayed_route_requires_destination'), 'a displayed route that fails to reach its promised destination must repair')
const vineyardDestination = inferActionDestination(carriageSave, cartridge, vineyardAction)!
const routeFallback = applyDisplayedRouteFallback(carriageSave, cartridge, vineyardAction, vineyardDestination)
equal(routeFallback.location, '银叶葡萄丘', 'after two bad drafts the local route fallback still completes the displayed destination')
ok(routeFallback.choices.length >= 1, 'the local route fallback remains playable')
ok(routeFallback.blocks.some((block) => block.data?.arrival === '银叶葡萄丘'), 'the local fallback records the same visible arrival as an ordinary map transition')

const routeRecovery = restoreDeterministicRecoveryChoice(applyConsistencyRecovery(carriageSave, cartridge, vineyardAction), cartridge)
equal(routeRecovery.choices[0]?.label, vineyardAction, 'an existing quarantined but semantically valid route is restored after upgrading')
ok(routeRecovery.choices[0]?.id.startsWith('route-recovery-'), 'the restored route bypasses the synthetic recovery-menu interceptor')

const discussionOnly = canonicalizeTurnMetadata(carriageSave, parseStoryProtocol(`你在月线车厢里听乘务员介绍葡萄藤和田野工作，但还没有下车。
[scene_location: location="月线车厢"]
[choices: "继续询问田野工作的要求"]`, 'zh'), cartridge)
ok(!discussionOnly.parsed.commands.some((command) => command.type === 'map_update'), 'merely discussing a remote field does not teleport the player')

const enCartridge = listCartridges('en')[0]
const enInitial = createInitialSave(enCartridge)
const enCarriage = enCartridge.initialMap.find((node) => node.id === 'moonline-carriage')!
const enCarriageSave = {
  ...enInitial,
  location: enCarriage.label,
  sceneLocation: enCarriage.label,
  map: enInitial.map.map((node) => ({ ...node, current: node.id === enCarriage.id })),
}
equal(inferActionDestination(enCarriageSave, enCartridge, 'Accept Mira’s work plan and head into the fields to inspect the trellis')?.id, 'silverleaf-vineyard', 'English semantic routes resolve to the same stable map id')

const openingDetour = canonicalizeTurnMetadata(initial, parseStoryProtocol(`你快步走进码头边上的旅店大堂，柜台后的招待告诉你：“单人间十枚钱币，含简单早餐。”你只了解情况，没有付款。你仍能回到月台、夜市或那位追种荚的短发女人身边。
[scene_location: location="灯湾码头"]
[choices: "去月台找乘务员问招工详情"|"去雨棚夜市帮忙搬箱子"|"跟那位追种荚的短发女人搭话"]`, 'zh'), cartridge)
const openingDetourChoices = openingDetour.parsed.commands.find((command) => command.type === 'choices')
ok(openingDetourChoices?.type === 'choices', 'a free-input detour keeps its choice command')
equal(openingDetourChoices.choices.length, 3, 'recent authoritative opening facts ground semantically continuous choices')
equal(validateTurnConsistency(initial, openingDetour.parsed, cartridge).length, 0, 'a valid free-input detour cannot be forced into consistency recovery')

const duplicatedSublocationDraft = `你走进灯湾码头旁的旅店，只问清十枚钱币的房价，没有付款。
[scene_location: location="灯湾码头旅店"]
[choices: "回到码头招工牌处了解工作"]`
const duplicatedSublocation = canonicalizeTurnMetadata(initial, parseStoryProtocol(`${duplicatedSublocationDraft}\n${duplicatedSublocationDraft}`, 'zh'), cartridge)
equal(duplicatedSublocation.parsed.commands.filter((command) => command.type === 'scene_location').length, 1, 'duplicated equivalent sublocation metadata is deduplicated')
equal(validateTurnConsistency(initial, duplicatedSublocation.parsed, cartridge).length, 0, 'a duplicated current-node sublocation cannot create a false recovery')
const committedSublocation = applyParsedScene(initial, duplicatedSublocation.parsed, cartridge, '只问清房价，不付款')
equal(committedSublocation.location, '灯湾码头', 'a sublocation cannot replace the authoritative map node')
equal(committedSublocation.sceneLocation, '灯湾码头旅店', 'the exact current scene is persisted independently')
const mismatchedSublocationImage = canonicalizeTurnMetadata(initial, parseStoryProtocol(`你仍在灯湾码头旅店柜台前。
[scene_location: location="灯湾码头旅店"]
[image_location: location="灯湾码头"]
[choices: "回到码头招工牌处了解工作"]`, 'zh'), cartridge, 'hotel counter image')
ok(validateTurnConsistency(initial, mismatchedSublocationImage.parsed, cartridge, mismatchedSublocationImage.imagePrompt).includes('image.location_must_match_scene'), 'an image bound only to the parent map node cannot depict a different sublocation')

ok(canCommitGeneratedTurnWithoutReplies(['turn.requires_actionable_choices']), 'valid generated prose may commit when only its next replies were filtered out')
ok(!canCommitGeneratedTurnWithoutReplies(['payment.purchase_requires_player_authorization']), 'a payment violation can never use the replyless commit path')
const replylessParsed = canonicalizeTurnMetadata(initial, parseStoryProtocol(`你走进灯湾码头旁的旅店，只问清十枚钱币的房价，没有付款。
[scene_location: location="灯湾码头"]`, 'zh'), cartridge).parsed
const replyless = applyParsedScene(initial, replylessParsed, cartridge, '只问清房价，不付款')
ok(replyless.choices.length >= 1, 'a replyless local detour retains prior grounded actions instead of entering a synthetic recovery')
ok(!replyless.blocks.some((block) => block.id.startsWith('consistency-recovery-')), 'replyless commit never writes a consistency-recovery story block')

for (const openingCartridge of [listCartridges('zh')[0], listCartridges('en')[0]]) {
  const openingSave = createInitialSave(openingCartridge)
  for (const choice of openingSave.choices) {
    const authored = resolveDeterministicOpeningTurn(openingSave, openingCartridge, choice.label)
    ok(authored, `${openingCartridge.locale} opening choice ${choice.id} has a deterministic local turn`)
    const paymentSafe = canonicalizePaymentMetadata(openingSave, parseStoryProtocol(authored.content, openingCartridge.locale), openingCartridge, choice.label)
    const consistent = canonicalizeTurnMetadata(openingSave, paymentSafe, openingCartridge, authored.imagePrompt, choice.label, true)
    equal(validatePaymentConsistency(openingSave, consistent.parsed, openingCartridge, choice.label).length, 0, `${openingCartridge.locale} opening choice ${choice.id} satisfies payment state`)
    equal(validateTurnConsistency(openingSave, consistent.parsed, openingCartridge, consistent.imagePrompt).length, 0, `${openingCartridge.locale} opening choice ${choice.id} satisfies turn state without a model repair`)
  }
}
equal(resolveDeterministicOpeningTurn(initial, cartridge, '我想去一个没有出现过的太空港'), undefined, 'free input remains open and never gets mistaken for a deterministic button')

ok(canCommitDisplayedChoiceWithoutGeneratedReplies(initial, cartridge, initial.choices[0].label, ['turn.requires_actionable_choices']), 'a displayed quick reply may commit a valid consequence even when the model loses every next reply')
ok(canCommitDisplayedChoiceWithoutGeneratedReplies({ ...initial, choices: [], sessionEnded: true }, cartridge, cartridge.copy.continue, ['turn.requires_actionable_choices']), 'the visible continue control receives the same reply-only execution promise')
const continueBase = { ...initial, choices: [], sessionEnded: true }
const continueParsed = canonicalizeTurnMetadata(continueBase, parseStoryProtocol(`你继续留在灯湾码头整理行李。
[scene_location: location="灯湾码头"]
[choices: "寻找从未出现的森林王后"]`, 'zh'), cartridge).parsed
const continueViolations = validateTurnConsistency(continueBase, continueParsed, cartridge)
ok(canCommitDisplayedChoiceWithoutGeneratedReplies(continueBase, cartridge, cartridge.copy.continue, continueViolations), 'continue accepts the narrow reply-only failure after full validation')
const continued = applyParsedScene(continueBase, continueParsed, cartridge, cartridge.copy.continue)
ok(continued.choices.length >= 1 && !continued.blocks.some((block) => block.id.startsWith('consistency-recovery-')), 'continue commits its consequence and reducer-owned feasible choices without recovery')
ok(!canCommitDisplayedChoiceWithoutGeneratedReplies(initial, cartridge, '我自己写的行动', ['turn.requires_actionable_choices']), 'free input does not inherit the displayed-choice execution promise')
ok(!canCommitDisplayedChoiceWithoutGeneratedReplies(initial, cartridge, initial.choices[0].label, ['turn.scene_location_must_match_state']), 'a displayed choice cannot bypass state consistency')

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

console.log(JSON.stringify({ ok: true, checks: ['bare-choice-recovery', 'scene-location-required', 'image-location-required', 'existing-task-not-misread', 'explicit-objective-required', 'objective-canonicalized', 'scene-location-canonicalized', 'ordinary-action-not-objective', 'unbound-image-discarded', 'action-aligned-consistency-recovery', 'local-confirm-exit', 'recovery-fourth-choice-preserved', 'local-pause-exit', 'nested-recovery-unwound', 'legacy-recovery-repaired', 'screenshot-loop-migrated', 'dead-choice-filtered-without-quota', 'hidden-noun-choice-filtered', 'known-save-repaired', 'old-image-prompt-removed'] }))
