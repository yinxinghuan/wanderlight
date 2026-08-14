import { encodeChoiceRecord } from './choiceInput'
import type { ParsedCommand, ParsedScene, StoryCartridge, StorySave } from '../types'

function clean(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s，。！？、,.!?;；:："“”'‘’()（）\-—_/]+/g, '')
}

function effectiveLocation(save: StorySave, parsed: ParsedScene): string {
  const update = [...parsed.commands].reverse().find((command) => command.type === 'map_update')
  return update?.type === 'map_update' ? update.location : save.location
}

function visibleProse(parsed: ParsedScene): string {
  return parsed.blocks
    .filter((block) => block.kind === 'narration' || block.kind === 'dialogue')
    .map((block) => block.text).join('\n')
}

function newTaskCue(locale: StoryCartridge['locale']): RegExp {
  return locale === 'zh'
    ? /你(?:现在)?(?:的)?(?:新|下一项|接下来(?:的)?)任务(?:是|为|：|:)|(?:接受|接下|领取|承担|受命执行|开始执行)[^。！？\n]{0,18}(?:任务|委托)|(?:交给|委托给|安排给)你[^。！？\n]{0,18}(?:任务|委托)/
    : /your (?:new|next) (?:task|assignment) (?:is|:)|(?:accept|take on|receive|begin executing).{0,48}(?:task|assignment)|(?:assign|entrust).{0,32}(?:task|assignment).{0,24}you/i
}

function inferredObjective(parsed: ParsedScene, cartridge: StoryCartridge): string | undefined {
  const cue = newTaskCue(cartridge.locale)
  const sentence = visibleProse(parsed).split(/(?<=[。！？.!?])|\n+/).map((value) => value.trim()).find((value) => cue.test(value))
  return sentence ? sentence.replace(/^[“”"']+|[“”"']+$/g, '').slice(0, 120) : undefined
}

/**
 * Canonicalize protocol-only metadata when the authoritative answer is already
 * known locally. Missing scene_location must not turn an otherwise playable
 * response into a dead end, and an unbound image proposal is safer to discard
 * than to reject the whole story turn.
 */
export function canonicalizeTurnMetadata(
  save: StorySave,
  parsed: ParsedScene,
  cartridge: StoryCartridge,
  imagePrompt?: string,
  action?: string,
): { parsed: ParsedScene; imagePrompt?: string; discardedImage: boolean } {
  const location = effectiveLocation(save, parsed)
  const sceneLocations = parsed.commands.filter((command): command is Extract<ParsedCommand, { type: 'scene_location' }> => command.type === 'scene_location')
  const imageLocations = parsed.commands.filter((command): command is Extract<ParsedCommand, { type: 'image_location' }> => command.type === 'image_location')
  let commands = parsed.commands

  if (sceneLocations.length === 0) commands = [...commands, { type: 'scene_location', location }]
  else if (sceneLocations.length > 1 && sceneLocations.every((command) => clean(command.location) === clean(sceneLocations[0].location))) {
    let retained = false
    commands = commands.filter((command) => {
      if (command.type !== 'scene_location') return true
      if (retained) return false
      retained = true
      return true
    })
  }

  if (!commands.some((command) => command.type === 'state')) {
    const objective = inferredObjective(parsed, cartridge)
    if (objective) commands = [...commands, { type: 'state', value: objective }]
  }

  let safeImagePrompt = imagePrompt
  let discardedImage = false
  if (imagePrompt && imageLocations.length === 0) {
    safeImagePrompt = undefined
    discardedImage = true
  } else if (!imagePrompt && imageLocations.length) {
    commands = commands.filter((command) => command.type !== 'image_location')
  } else if (imagePrompt && imageLocations.length > 1 && imageLocations.every((command) => clean(command.location) === clean(imageLocations[0].location))) {
    let retained = false
    commands = commands.filter((command) => {
      if (command.type !== 'image_location') return true
      if (retained) return false
      retained = true
      return true
    })
  }

  return { parsed: commands === parsed.commands ? parsed : { ...parsed, commands }, imagePrompt: safeImagePrompt, discardedImage }
}

function validChoices(parsed: ParsedScene): string[] {
  const command = [...parsed.commands].reverse().find((entry) => entry.type === 'choices')
  if (command?.type !== 'choices') return []
  const labels = command.choices.map((label) => label.trim()).filter((label) => label.length >= 2 && label.length <= 96)
  return labels.length >= 2 && labels.length <= 5 && new Set(labels).size === labels.length ? labels : []
}

function stalePlaceChoice(choice: string, location: string, save: StorySave): boolean {
  const destinationVerb = /(?:前往|去往|去|返回|回到|搭乘|乘坐|买票|离开|赶往|travel|go to|head to|return|ride|take .* to|leave for)/i
  return save.map.some((node) => node.label !== location && clean(choice).includes(clean(node.label)) && !destinationVerb.test(choice))
}

export function validateTurnConsistency(
  save: StorySave,
  parsed: ParsedScene,
  cartridge: StoryCartridge,
  imagePrompt?: string,
): string[] {
  const violations = new Set<string>()
  const location = effectiveLocation(save, parsed)
  const sceneLocations = parsed.commands.filter((command): command is Extract<ParsedCommand, { type: 'scene_location' }> => command.type === 'scene_location')
  const imageLocations = parsed.commands.filter((command): command is Extract<ParsedCommand, { type: 'image_location' }> => command.type === 'image_location')
  const mapUpdates = parsed.commands.filter((command) => command.type === 'map_update')
  const choices = validChoices(parsed)
  const prose = visibleProse(parsed)

  if (sceneLocations.length !== 1) violations.add('turn.requires_one_scene_location')
  else if (clean(sceneLocations[0].location) !== clean(location)) violations.add('turn.scene_location_must_match_state')
  if (mapUpdates.length > 1) violations.add('turn.allows_one_map_update')

  if (imagePrompt) {
    if (imageLocations.length !== 1) violations.add('image.requires_one_image_location')
    else if (clean(imageLocations[0].location) !== clean(location)) violations.add('image.location_must_match_scene')
  } else if (imageLocations.length) violations.add('image.location_without_image')

  if (!parsed.commands.some((command) => command.type === 'session_end') && !choices.length) violations.add('turn.requires_actionable_choices')
  if (choices.some((choice) => stalePlaceChoice(choice, location, save))) violations.add('choices.cannot_act_in_stale_location')

  if (newTaskCue(cartridge.locale).test(prose) && !parsed.commands.some((command) => command.type === 'state')) violations.add('turn.new_task_requires_objective_state')

  const arrivedAtOtherKnownPlace = save.map.some((node) => clean(node.label) !== clean(save.location)
    && prose.split(/(?<=[。！？.!?])|\n+/).some((sentence) => clean(sentence).includes(clean(node.label))
      && /(?:抵达|到达|来到|走进|进入|已经在|身处|下车|arriv|reach|enter|step into|now in|get off)/i.test(sentence)))
  if (arrivedAtOtherKnownPlace && !mapUpdates.length) violations.add('turn.visible_arrival_requires_map_update')

  return [...violations]
}

export function repairKnownForestSceneDivergence<T extends {
  scene: number
  location: string
  objective: string
  facts?: StorySave['facts']
  blocks: StorySave['blocks']
  choices: StorySave['choices']
  map: StorySave['map']
}>(candidate: T, cartridge: StoryCartridge): T {
  const repairId = 'legacy-forest-patrol-choice-image-v1'
  if (candidate.facts?.[repairId] || clean(candidate.location) !== clean(cartridge.opening.location)) return candidate
  const visible = candidate.blocks
    .filter((block) => block.kind === 'narration' || block.kind === 'dialogue')
    .slice(-30).map((block) => block.text).join('\n')
  const exactEvidence = /你准备/.test(visible)
    && /跟随护林人开始巡逻/.test(visible)
    && /观察周围环境，留意可能的异常动静/.test(visible)
    && /询问林薇是否愿意一起制定应对突发状况的计划/.test(visible)
  const staleChoices = candidate.choices.some((choice) => /灯湾码头|末班月线/.test(choice.label))
  const target = candidate.map.find((node) => node.id === 'mistpine-forest')
    ?? cartridge.initialMap.find((node) => node.id === 'mistpine-forest')
  if (!exactEvidence || !staleChoices || !target) return candidate

  const labels = [
    '跟随护林人开始巡逻，尽快完成任务',
    '观察周围环境，留意可能的异常动静',
    '询问林薇是否愿意一起制定应对突发状况的计划',
  ]
  const choices = labels.map((label, index) => ({ id: `${candidate.scene}-${index}`, label }))
  const optionText = new Set(['你准备：', '你准备:', ...labels])
  const map = candidate.map.map((node) => ({ ...node, current: node.id === target.id, visited: node.id === target.id ? true : node.visited }))
  if (!map.some((node) => node.id === target.id)) map.push({ ...target, current: true, visited: true })
  const blocks = candidate.blocks
    .filter((block) => !(block.kind === 'narration' && optionText.has(block.text.trim())))
    .map((block) => {
      if (block.id === `choices-${candidate.scene}` && block.kind === 'choices') return { ...block, text: encodeChoiceRecord(choices) }
      if (block.id === `image-${candidate.scene}` && block.kind === 'image') return {
        ...block,
        text: target.label,
        data: { ...block.data, status: 'queued', url: '', promptVersion: '0', source: 'director', reason: 'cadence' },
      }
      return block
    })
  return {
    ...candidate,
    location: target.label,
    objective: '跟随护林人完成今晚的巡逻任务',
    facts: { ...(candidate.facts ?? {}), [repairId]: true },
    blocks,
    choices,
    map,
  }
}
