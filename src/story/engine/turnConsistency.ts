import { encodeChoiceRecord } from './choiceInput'
import { filterGroundedChoices } from './continuity'
import { resolveDomainAction } from './domainRules'
import type { MapNode, ParsedCommand, ParsedScene, StoryCartridge, StorySave } from '../types'

function clean(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s，。！？、,.!?;；:："“”'‘’()（）\-—_/]+/g, '')
}

function effectiveLocation(save: StorySave, parsed: ParsedScene): string {
  const update = [...parsed.commands].reverse().find((command) => command.type === 'map_update')
  return update?.type === 'map_update' ? update.location : save.location
}

function sceneBelongsToMapLocation(sceneLocation: string, mapLocation: string, save: StorySave, cartridge: StoryCartridge): boolean {
  const scene = clean(sceneLocation)
  const map = clean(mapLocation)
  if (scene === map || scene.includes(map)) return true
  const node = mapNodes(save, cartridge).find((candidate) => clean(candidate.label) === map)
  return Boolean(node?.routeHints?.some((hint) => {
    const normalized = clean(hint)
    return normalized.length >= 2 && scene.includes(normalized)
  }))
}

function mapNodes(save: Pick<StorySave, 'map'>, cartridge: Pick<StoryCartridge, 'initialMap'>): MapNode[] {
  const definitions = new Map(cartridge.initialMap.map((node) => [node.id, node]))
  const merged: MapNode[] = save.map.map((node) => {
    const definition = definitions.get(node.id)
    return { ...definition, ...node, routeHints: node.routeHints ?? definition?.routeHints }
  })
  cartridge.initialMap.forEach((node) => {
    if (!merged.some((candidate) => candidate.id === node.id || clean(candidate.label) === clean(node.label))) merged.push(node)
  })
  return merged
}

function routeMovementCue(value: string, locale: StoryCartridge['locale']): boolean {
  return locale === 'zh'
    ? /(?:前往|去往|赶往|返回|回到|进入|走进|走到|抵达|到达|下车|离开|往[^。！？\n]{0,28}(?:走|去|检查|干活|工作|修补)|沿[^。！？\n]{0,28}(?:走|前进)|跟随|带着|陪同)/.test(value)
    : /\b(?:travel|go|head|return|enter|walk|reach|arrive|get off|leave|follow|accompany)\b/i.test(value)
}

function routeMatchScore(value: string, node: MapNode): number {
  const normalized = clean(value)
  const label = clean(node.label)
  let score = normalized.includes(label) ? 100 + label.length : 0
  const matches = new Set((node.routeHints ?? []).map(clean).filter((hint) => hint.length >= 2 && normalized.includes(hint)))
  matches.forEach((hint) => { score += 10 + Math.min(hint.length, 12) })
  return score
}

/** Resolve a system/free-input route to a stable map id before generation.
 * The route must contain both an actual movement/commitment cue and a unique
 * destination fingerprint; merely discussing a remote place does not move. */
export function inferActionDestination(save: StorySave, cartridge: StoryCartridge, action: string): MapNode | undefined {
  if (!routeMovementCue(action, cartridge.locale)) return undefined
  const candidates = mapNodes(save, cartridge)
    .filter((node) => clean(node.label) !== clean(save.location))
    .map((node) => ({ node, score: routeMatchScore(action, node) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
  if (!candidates.length || candidates[0].score === candidates[1]?.score) return undefined
  return candidates[0].node
}

function inferVisibleDestination(save: StorySave, cartridge: StoryCartridge, parsed: ParsedScene): MapNode | undefined {
  const prose = visibleProse(parsed)
  const embodied = cartridge.locale === 'zh'
    ? /(?:你|你们)[^。！？\n]{0,24}(?:已经在|正在|开始|走进|进入|抵达|到达|下车|穿过)/.test(prose)
    : /\b(?:you|your group)\b.{0,60}\b(?:are now|begin|enter|reach|arrive|get off|cross)\b/i.test(prose)
  if (!embodied) return undefined
  const candidates = mapNodes(save, cartridge)
    .filter((node) => clean(node.label) !== clean(save.location))
    .map((node) => ({ node, score: routeMatchScore(prose, node) }))
    .filter(({ node, score }) => score >= 100 || (score > 0 && (node.routeHints ?? []).filter((hint) => clean(hint).length >= 2 && clean(prose).includes(clean(hint))).length >= 2))
    .sort((a, b) => b.score - a.score)
  if (!candidates.length || candidates[0].score === candidates[1]?.score) return undefined
  return candidates[0].node
}

function explicitlyRemainsAtCurrentLocation(save: StorySave, cartridge: StoryCartridge, parsed: ParsedScene): boolean {
  const current = mapNodes(save, cartridge).find((node) => clean(node.label) === clean(save.location))
  const labels = [current?.label ?? save.location, ...(current?.routeHints ?? [])].filter((value) => clean(value).length >= 2)
  return visibleProse(parsed).split(/(?<=[。！？.!?])|\n+/).some((sentence) => {
    const mentionsCurrent = labels.some((label) => clean(sentence).includes(clean(label)))
    const remains = cartridge.locale === 'zh'
      ? /(?:仍在|还在|依然在|仍留在|没有离开|暂时留在)/.test(sentence)
      : /\b(?:still|remain|stays?|have not left|has not left)\b/i.test(sentence)
    return mentionsCurrent && remains
  })
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
  trustedAuthored = false,
): { parsed: ParsedScene; imagePrompt?: string; discardedImage: boolean } {
  let commands = parsed.commands
  let originalSceneLocations = commands.filter((command): command is Extract<ParsedCommand, { type: 'scene_location' }> => command.type === 'scene_location')
  // Models occasionally repeat an otherwise identical response during a
  // repair. Collapse equivalent location metadata before sublocation
  // canonicalization; doing this afterwards leaves one duplicated
  // "Quay hotel" label looking like a teleport away from "Quay".
  if (originalSceneLocations.length > 1 && originalSceneLocations.every((command) => clean(command.location) === clean(originalSceneLocations[0].location))) {
    let retained = false
    commands = commands.filter((command) => {
      if (command.type !== 'scene_location') return true
      if (retained) return false
      retained = true
      return true
    })
    originalSceneLocations = commands.filter((command): command is Extract<ParsedCommand, { type: 'scene_location' }> => command.type === 'scene_location')
  }
  let hasMapUpdate = commands.some((command) => command.type === 'map_update')
  if (!hasMapUpdate && originalSceneLocations.length === 1 && clean(originalSceneLocations[0].location) !== clean(save.location)) {
    const destination = save.map.find((node) => clean(node.label) === clean(originalSceneLocations[0].location))
      ?? cartridge.initialMap.find((node) => clean(node.label) === clean(originalSceneLocations[0].location))
    const prose = visibleProse(parsed)
    const visiblyArrived = destination && prose.split(/(?<=[。！？.!?])|\n+/).some((sentence) => clean(sentence).includes(clean(destination.label))
      && /(?:抵达|到达|来到|走进|进入|已经在|身处|下车|穿过.+(?:走进|进入)|arriv|reach|enter|step into|now in|get off|cross.+into)/i.test(sentence))
    if (destination && visiblyArrived) {
      commands = [...commands, {
        type: 'map_update', location: destination.label, connectedTo: destination.connectedTo,
        detail: destination.detail, lore: destination.lore, facts: destination.facts,
      }]
      hasMapUpdate = true
    }
  }

  if (!hasMapUpdate) {
    const destination = (action ? inferActionDestination(save, cartridge, action) : undefined)
      ?? inferVisibleDestination(save, cartridge, { ...parsed, commands })
    if (destination && !explicitlyRemainsAtCurrentLocation(save, cartridge, { ...parsed, commands })) {
      commands = commands.filter((command) => command.type !== 'scene_location'
        || sceneBelongsToMapLocation(command.location, destination.label, save, cartridge))
      commands = [...commands, {
        type: 'map_update', location: destination.label, connectedTo: destination.connectedTo,
        detail: destination.detail, lore: destination.lore, facts: destination.facts,
      }]
      hasMapUpdate = true
    }
  }

  const location = effectiveLocation(save, { ...parsed, commands })
  const sceneLocations = commands.filter((command): command is Extract<ParsedCommand, { type: 'scene_location' }> => command.type === 'scene_location')
  const imageLocations = commands.filter((command): command is Extract<ParsedCommand, { type: 'image_location' }> => command.type === 'image_location')

  if (sceneLocations.length === 0) commands = [...commands, { type: 'scene_location', location: hasMapUpdate ? location : save.sceneLocation ?? location }]
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
    const boundSceneLocation = commands.find((command): command is Extract<ParsedCommand, { type: 'scene_location' }> => command.type === 'scene_location')?.location ?? location
    if (trustedAuthored) commands = [...commands, { type: 'image_location', location: boundSceneLocation }]
    else {
      safeImagePrompt = undefined
      discardedImage = true
    }
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

  let choiceIndex = -1
  commands.forEach((command, index) => { if (command.type === 'choices') choiceIndex = index })
  if (choiceIndex >= 0) {
    const command = commands[choiceIndex]
    if (command.type === 'choices') {
      const seen = new Set<string>()
      const candidates = command.choices
        .map((label) => label.trim())
        .filter((label) => label.length >= 2 && label.length <= 96 && !seen.has(label) && Boolean(seen.add(label)))
        .filter((label) => !stalePlaceChoice(label, location, save))
        .slice(0, 5)
        .map((label, index) => ({ id: `candidate-${index}`, label }))
      const mapUpdate = commands.find((entry): entry is Extract<ParsedCommand, { type: 'map_update' }> => entry.type === 'map_update')
      const objectiveUpdate = [...commands].reverse().find((entry): entry is Extract<ParsedCommand, { type: 'state' }> => entry.type === 'state')
      const sceneLocationUpdate = [...commands].reverse().find((entry): entry is Extract<ParsedCommand, { type: 'scene_location' }> => entry.type === 'scene_location')
      const offeredJobs = commands.filter((entry): entry is Extract<ParsedCommand, { type: 'job' }> => entry.type === 'job' && entry.action === 'offer')
      const groundedMap = mapUpdate
        ? save.map.map((node) => clean(node.label) === clean(mapUpdate.location)
          ? { ...node, current: true, visited: true, detail: mapUpdate.detail ?? node.detail, lore: mapUpdate.lore ?? node.lore, facts: mapUpdate.facts ?? node.facts }
          : { ...node, current: false })
        : save.map
      const candidateSave = {
        ...save,
        location,
        sceneLocation: sceneLocationUpdate?.location ?? save.sceneLocation ?? location,
        objective: objectiveUpdate?.value ?? save.objective,
        map: groundedMap,
        jobs: [
          ...save.jobs,
          ...offeredJobs.map((job) => ({
            id: job.id, label: job.label ?? job.id, employer: job.employer, wage: job.wage ?? 0,
            status: 'offered' as const, offeredAtScene: save.scene + 1,
          })),
        ],
        blocks: [...save.blocks, ...parsed.blocks],
      }
      const textGrounded = new Set(filterGroundedChoices(candidates, candidateSave, cartridge, parsed.blocks).map((choice) => choice.label))
      const grounded = candidates.filter((choice) => {
        const domain = resolveDomainAction(candidateSave, cartridge, choice.label)
        return domain ? domain.status === 'accepted' : textGrounded.has(choice.label)
      }).map((choice) => choice.label)
      if (grounded.length !== command.choices.length || grounded.some((label, index) => label !== command.choices[index])) {
        commands = commands.map((entry, index) => index === choiceIndex ? { type: 'choices' as const, choices: grounded } : entry)
      }
    }
  }

  return { parsed: commands === parsed.commands ? parsed : { ...parsed, commands }, imagePrompt: safeImagePrompt, discardedImage }
}

function validChoices(parsed: ParsedScene): string[] {
  const command = [...parsed.commands].reverse().find((entry) => entry.type === 'choices')
  if (command?.type !== 'choices') return []
  const labels = command.choices.map((label) => label.trim()).filter((label) => label.length >= 2 && label.length <= 96)
  return labels.length >= 1 && labels.length <= 5 && new Set(labels).size === labels.length ? labels : []
}

export function canCommitDisplayedChoiceWithoutGeneratedReplies(
  save: Pick<StorySave, 'choices' | 'sessionEnded'>,
  cartridge: Pick<StoryCartridge, 'copy'>,
  action: string,
  violations: string[],
): boolean {
  const selected = clean(action)
  return Boolean(selected)
    && (save.choices.some((choice) => clean(choice.label) === selected)
      || (save.sessionEnded && clean(cartridge.copy.continue) === selected))
    && violations.length > 0
    && violations.every((violation) => violation === 'turn.requires_actionable_choices')
}

/** A generated consequence is still safe to commit when only its suggested
 * replies were filtered out. Payment, location, objective, and other state
 * violations must still repair or reject the whole draft. */
export function canCommitGeneratedTurnWithoutReplies(violations: string[]): boolean {
  return violations.length > 0 && violations.every((violation) => violation === 'turn.requires_actionable_choices')
}

function stalePlaceChoice(choice: string, location: string, save: StorySave): boolean {
  const destinationVerb = /(?:前往|去往|去|返回|回到|搭乘|乘坐|乘车到|坐到|陪.+到|买票|离开|赶往|送去|送到|带去|护送|通往|检查.+支线|travel|go to|head to|return|ride|take .* to|leave for|deliver .* to|bring .* to|escort .* to)/i
  const mapChanged = clean(location) !== clean(save.location)
  return save.map.some((node) => (mapChanged || !node.current)
    && clean(node.label) !== clean(location)
    && clean(choice).includes(clean(node.label))
    && !destinationVerb.test(choice))
}

export function validateTurnConsistency(
  save: StorySave,
  parsed: ParsedScene,
  cartridge: StoryCartridge,
  imagePrompt?: string,
  action?: string,
): string[] {
  const violations = new Set<string>()
  const location = effectiveLocation(save, parsed)
  const sceneLocations = parsed.commands.filter((command): command is Extract<ParsedCommand, { type: 'scene_location' }> => command.type === 'scene_location')
  const imageLocations = parsed.commands.filter((command): command is Extract<ParsedCommand, { type: 'image_location' }> => command.type === 'image_location')
  const mapUpdates = parsed.commands.filter((command) => command.type === 'map_update')
  const choices = validChoices(parsed)
  const prose = visibleProse(parsed)

  if (sceneLocations.length !== 1) violations.add('turn.requires_one_scene_location')
  else if (!sceneBelongsToMapLocation(sceneLocations[0].location, location, save, cartridge)) violations.add('turn.scene_location_must_match_state')
  if (mapUpdates.length > 1) violations.add('turn.allows_one_map_update')

  if (imagePrompt) {
    if (imageLocations.length !== 1) violations.add('image.requires_one_image_location')
    else if (sceneLocations.length !== 1 || clean(imageLocations[0].location) !== clean(sceneLocations[0].location)) violations.add('image.location_must_match_scene')
  } else if (imageLocations.length) violations.add('image.location_without_image')

  if (!parsed.commands.some((command) => command.type === 'session_end') && !choices.length) violations.add('turn.requires_actionable_choices')
  if (choices.some((choice) => stalePlaceChoice(choice, location, save))) violations.add('choices.cannot_act_in_stale_location')

  if (newTaskCue(cartridge.locale).test(prose) && !parsed.commands.some((command) => command.type === 'state')) violations.add('turn.new_task_requires_objective_state')

  const actionDestination = action ? inferActionDestination(save, cartridge, action) : undefined
  if (actionDestination && clean(location) !== clean(actionDestination.label)) violations.add('turn.displayed_route_requires_destination')

  const arrivedAtOtherKnownPlace = mapNodes(save, cartridge).some((node) => clean(node.label) !== clean(save.location)
    && prose.split(/(?<=[。！？.!?])|\n+/).some((sentence) => clean(sentence).includes(clean(node.label))
      && /(?:抵达|到达|来到|走进|进入|已经在|身处|下车|arriv|reach|enter|step into|now in|get off)/i.test(sentence)))
  if (arrivedAtOtherKnownPlace && !mapUpdates.length) violations.add('turn.visible_arrival_requires_map_update')
  if (inferVisibleDestination(save, cartridge, parsed) && !mapUpdates.length) violations.add('turn.visible_arrival_requires_map_update')

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
