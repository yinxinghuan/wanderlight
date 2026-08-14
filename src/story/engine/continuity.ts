import type { Choice, StoryBlock, StoryCartridge, StorySave } from '../types'

function clean(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s，。！？、,.!?;；:："“”'‘’()（）\-—_/]+/g, '')
}

export function authoredDecisionContext(value: string, visibleTurnText: string, locale: StoryCartridge['locale']): string {
  const normalized = value.replace(/[\n\r\t]+/g, ' ').replace(/^[“”"'‘’]+|[“”"'‘’]+$/g, '').replace(/\s+/g, ' ').trim()
  const maxLength = locale === 'zh' ? 28 : 96
  if (!normalized || normalized.length > maxLength) return ''
  if (/请(?:做出|作出)?选择|接下来(?:怎么|如何)做|what (?:will|do) you do|make (?:a|your) choice/i.test(normalized)) return ''
  if (clean(visibleTurnText).includes(clean(normalized))) return ''
  return normalized
}

export function createTransitionBlock(
  save: Pick<StorySave, 'scene' | 'location'>,
  destination: string | undefined,
  cartridge: StoryCartridge,
): StoryBlock | undefined {
  const anchor = cartridge.transitionAnchor?.trim()
  if (!anchor || !destination || clean(destination) === clean(save.location)) return undefined
  const destinationNode = cartridge.initialMap.find((node) => clean(node.label) === clean(destination) || clean(node.id) === clean(destination))
  const originNode = cartridge.initialMap.find((node) => clean(node.label) === clean(save.location) || clean(node.id) === clean(save.location))
  const isLocalConnection = clean(destinationNode?.connectedTo ?? '') === clean(save.location)
    || clean(originNode?.connectedTo ?? '') === clean(destination)
  if (isLocalConnection && !clean(anchor).includes(clean(destination)) && !clean(anchor).includes(clean(save.location))) return undefined
  const destinationIsAnchor = clean(anchor).includes(clean(destination))
  if (destinationIsAnchor) return undefined
  const originIsAnchor = clean(anchor).includes(clean(save.location))
  const text = cartridge.locale === 'zh'
    ? originIsAnchor
      ? `车厢轻轻晃动，窗外的灯沿湿玻璃退远。列车减速、车门再次打开时，${destination}才出现在你眼前。`
      : `你先离开${save.location}，回到${anchor}。车门合拢，旧地点的灯光沿湿窗退远；列车停稳、车门再次打开时，${destination}才出现在眼前。`
    : originIsAnchor
      ? `The carriage sways into motion and lights retreat along the wet glass. Only when the train slows and the doors open again does ${destination} appear.`
      : `You first leave ${save.location} and return to ${anchor}. The doors close and the old lights retreat along the wet window; only when the train stops and opens again does ${destination} appear.`
  return { id: `transition-${save.scene + 1}`, kind: 'narration', text, data: { transitionAnchor: anchor, destination } }
}

function chineseTerms(value: string): string[] {
  const generic = /(?:为什么|有什么用|尚未|当前|现在|原地|这里|那里|周围|下一步|情况|局面|方式|事情|行动|工作|线索|变化|一起|自己|这些|哪条|那张|那场|一个|一份|一条|一段|今晚|明早|清晨|下一站|到站后|先|再|也|就|仍然|还在|请|去|前往|前进|沿着?|循着?|跟随|返回|回到|留下|留在|等待|观察|查看|看看|检查|调查|搜索|询问|问|谈谈|告诉|介绍|帮助|帮忙|帮|拒绝|接受|接下|答应|邀请|负责|进入|使用|带着?|把|将|让|与|和|继续|尝试|绕到?|登上|走向|停下|休息|闭眼|坐到?|坐|陪|拿|收好|离开|加入|开始|完成|做完|整理|搬运|搬|寻找|找|追查|放弃|改走|送上|送去|送到|带去|唱给|压平|摆好|拦住|选择|决定|谁|听|最|突然|她|他|它|对方|的|了|后|人|在)/gu
  const stripped = value.replace(generic, ' ')
  return [...new Set((stripped.match(/[\u3400-\u9fff]{2,8}/gu) ?? [])
    .map((term) => term.replace(/[上旁边里内外中前后]$/u, ''))
    .filter((term) => term.length >= 2))]
}

function englishTerms(value: string): string[] {
  const generic = new Set(['with', 'from', 'into', 'about', 'around', 'again', 'next', 'current', 'situation', 'continue', 'inspect', 'observe', 'check', 'ask', 'tell', 'help', 'return', 'follow', 'leave', 'wait', 'take', 'make', 'try', 'use', 'look', 'move'])
  return [...new Set(value.toLocaleLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((term) => !generic.has(term))
}

function choiceIsGrounded(
  choice: Choice,
  source: string,
  locale: StoryCartridge['locale'],
  stableEntities: string[],
): boolean {
  let termSource = choice.label
  if (locale === 'zh') {
    for (const entity of stableEntities.sort((left, right) => right.length - left.length)) {
      if (entity.length < 2 || !clean(termSource).includes(clean(entity))) continue
      if (!clean(source).includes(clean(entity))) return false
      termSource = termSource.replaceAll(entity, ' ')
    }
  }
  const terms = locale === 'zh' ? chineseTerms(termSource) : englishTerms(termSource)
  if (!terms.length) return true
  const normalizedSource = clean(source)
  if (normalizedSource.includes(clean(choice.label))) return true
  const matches = terms.filter((term) => normalizedSource.includes(clean(term)))
  if (locale === 'en') return matches.length > 0
  return matches.length === terms.length
}

export function filterGroundedChoices(
  choices: Choice[],
  save: StorySave,
  cartridge: StoryCartridge,
  immediateBlocks: StoryBlock[] = save.blocks,
): Choice[] {
  const visibleTurn = immediateBlocks
    .filter((block) => block.kind !== 'image' && !block.id.startsWith('action-'))
    .map((block) => `${block.speaker ?? ''} ${block.text}`)
  const knownPeople = save.characters.filter((character) => character.status !== 'departed').map((character) => character.name)
  const knownPlaces = save.map.filter((node) => node.visited || node.current).flatMap((node) => [node.label, node.detail ?? '', node.lore ?? '', ...(node.facts ?? [])])
  const knownItems = save.inventory.map((item) => item.label)
  const activeJobs = save.jobs.filter((job) => job.status === 'offered' || job.status === 'accepted').flatMap((job) => [job.label, job.employer ?? ''])
  const source = [...visibleTurn, save.location, save.objective, ...knownPeople, ...knownPlaces, ...knownItems, ...activeJobs].join(' ')
  const stableEntities = [...knownPeople, save.location, ...knownPlaces, ...knownItems, ...activeJobs].filter(Boolean)
  const quarantined = typeof save.facts.consistency_quarantined_action === 'string'
    && save.facts.consistency_quarantined_location === save.location
    ? clean(save.facts.consistency_quarantined_action)
    : ''
  return choices.filter((choice) => (!quarantined || clean(choice.label) !== quarantined)
    && choiceIsGrounded(choice, source, cartridge.locale, stableEntities))
}

export function choicesAreGrounded(choices: Choice[], save: StorySave, cartridge: StoryCartridge): boolean {
  return filterGroundedChoices(choices, save, cartridge).length === choices.length
}
