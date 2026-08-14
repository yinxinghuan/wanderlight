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
  const stripped = value
    .replace(/^(?:先|去|前往|沿着?|循着?|跟随|返回|回到|留下|留在|等待|观察|查看|检查|调查|搜索|询问|告诉|帮助|拒绝|接受|进入|使用|带着?|把|让|与|继续|尝试|绕到?|登上|走向|停下|休息|坐到?|决定|选择)+/u, '')
    .replace(/(?:一下|一遍|下一步|当前|现在|原地|这里|那里|周围|情况|局面|方式|事情|行动|线索|变化|继续|等待|再说|商量)/gu, '')
  const terms = new Set<string>()
  for (const chunk of stripped.match(/[\u3400-\u9fff]{2,}/gu) ?? []) {
    if (chunk.length <= 6) terms.add(chunk)
    for (let index = 0; index < chunk.length - 1; index += 1) terms.add(chunk.slice(index, index + 2))
  }
  return [...terms]
}

function englishTerms(value: string): string[] {
  const generic = new Set(['with', 'from', 'into', 'about', 'around', 'again', 'next', 'current', 'situation', 'continue', 'inspect', 'observe', 'check', 'ask', 'tell', 'help', 'return', 'follow', 'leave', 'wait', 'take', 'make', 'try', 'use', 'look', 'move'])
  return [...new Set(value.toLocaleLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((term) => !generic.has(term))
}

function choiceIsGrounded(choice: Choice, source: string, locale: StoryCartridge['locale']): boolean {
  const terms = locale === 'zh' ? chineseTerms(choice.label) : englishTerms(choice.label)
  if (!terms.length) return true
  const normalizedSource = clean(source)
  return terms.some((term) => normalizedSource.includes(clean(term)))
}

export function filterGroundedChoices(choices: Choice[], save: StorySave, cartridge: StoryCartridge): Choice[] {
  const visibleHistory = save.blocks
    .filter((block) => block.kind !== 'image' && !block.id.startsWith('action-'))
    .map((block) => `${block.speaker ?? ''} ${block.text}`)
  const knownPeople = save.characters.filter((character) => character.status !== 'departed').map((character) => character.name)
  const knownPlaces = save.map.filter((node) => node.visited || node.current).map((node) => node.label)
  const knownItems = save.inventory.map((item) => item.label)
  const source = [...visibleHistory, save.location, save.objective, ...knownPeople, ...knownPlaces, ...knownItems].join(' ')
  return choices.filter((choice) => choiceIsGrounded(choice, source, cartridge.locale))
}

export function choicesAreGrounded(choices: Choice[], save: StorySave, cartridge: StoryCartridge): boolean {
  return filterGroundedChoices(choices, save, cartridge).length === choices.length
}
