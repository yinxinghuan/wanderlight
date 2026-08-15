import type {
  DomainActionResolution, DomainEffect, DomainRequirement, ParsedCommand, StoryBlock, StoryCartridge, StorySave,
} from '../types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function advanceClock(save: StorySave, minutes: number, locale: StoryCartridge['locale']): void {
  const match = save.time.match(/(\d{1,2}):(\d{2})/)
  const currentMinutes = match ? Number(match[1]) * 60 + Number(match[2]) : 18 * 60 + 40
  const visibleDay = save.time.match(/(?:第\s*(\d+)\s*天|Day\s*(\d+))/i)
  const currentDay = Math.max(1, Number(visibleDay?.[1] ?? visibleDay?.[2] ?? save.facts.world_day ?? 1))
  const absolute = currentMinutes + Math.max(0, Math.round(minutes))
  const day = currentDay + Math.floor(absolute / 1440)
  const withinDay = absolute % 1440
  const hour = Math.floor(withinDay / 60)
  const minute = withinDay % 60
  save.facts.world_day = day
  save.time = `${locale === 'zh' ? `第 ${day} 天` : `Day ${day}`} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s，。！？、,.!?;；:："“”'‘’()（）]+/g, '')
}

function isRestCommitment(value: string): boolean {
  const source = value.trim().toLocaleLowerCase()
  const chineseRest = /(?:休息|歇一会|小睡|睡一会|睡觉|打盹|眯一会|恢复呼吸|住一晚|租[^，。！？]{0,8}房|支付房费|付房费|订[^，。！？]{0,8}房|今天不再行动)/u.test(source)
  const englishRest = /\b(?:rest|sleep|nap|doze)(?:ing)?\b|\b(?:take a break|catch my breath|stay for the night|rent (?:a )?room|pay (?:the )?room fee|book (?:a )?room|reserve (?:a )?room|stop for the day)\b/i.test(source)
  if (!chineseRest && !englishRest) return false
  const chineseNegation = /(?:不|别)(?:要|想|打算|准备|再)?(?:休息|睡|小睡|打盹|住下)/u.test(source)
  const englishNegation = /\b(?:do not|don't|not going to|won't|without|skip)\b.{0,24}\b(?:rest|sleep|nap|stay)\b/i.test(source)
  const chineseReport = /(?:告诉|跟[^，。！？]{0,10}说|对[^，。！？]{0,10}说|表示|说明).{0,24}(?:休息|睡|住下)/u.test(source)
  const englishReport = /\b(?:tell|say to|explain to|let [a-z ]{1,20} know)\b.{0,48}\b(?:rest|sleep|stay)\b/i.test(source)
  const chineseInquiry = /(?:问|询问|打听|了解|看看|查看).{0,18}(?:休息|睡|客房|房间)|(?:哪里|哪儿|有没有|能不能|是否).{0,18}(?:休息|睡|客房|房间)|(?:休息|客房|房间).{0,12}(?:多少钱|价格|条件)/u.test(source)
  const englishInquiry = /\b(?:ask|inquire|check|learn|find out|whether|where can|is there|how much|price)\b.{0,48}\b(?:rest|sleep|nap|room|bed|shelter)\b/i.test(source)
    || /\b(?:rest|room|bed|shelter)\b.{0,32}\b(?:price|cost|available|availability)\b/i.test(source)
  return !chineseNegation && !englishNegation && !chineseReport && !englishReport && !chineseInquiry && !englishInquiry
}

function matchStrength(source: string, keyword: string): number {
  if (source.includes(keyword)) return 200 + keyword.length
  if (!/[\u3400-\u9fff]/.test(keyword)) return 0
  let cursor = 0
  for (const character of source) {
    if (character === keyword[cursor]) cursor += 1
    if (cursor === keyword.length) return keyword.length
  }
  return 0
}

function currentMapNodeId(save: StorySave): string | undefined {
  return save.map.find((node) => node.current)?.id
}

export function activeStatFloorRule(save: StorySave, cartridge: StoryCartridge) {
  for (const definition of cartridge.statDefinitions) {
    const rule = definition.floorRule
    if (!rule) continue
    const threshold = rule.threshold ?? definition.min
    const value = Number(save.stats[definition.id] ?? definition.initial)
    if (Number.isFinite(value) && value <= threshold) return { definition, rule, threshold, value }
  }
  return undefined
}

export function statFloorChoices(save: StorySave, cartridge: StoryCartridge): StorySave['choices'] | undefined {
  const floor = activeStatFloorRule(save, cartridge)
  return floor?.rule.recoveryChoices.map((label, index) => ({ id: `recovery-${save.scene}-${index}`, label }))
}

function requirementMet(requirement: DomainRequirement, save: StorySave): boolean {
  if (requirement.type === 'map') {
    const current = currentMapNodeId(save)
    if (requirement.nodeId && current !== requirement.nodeId) return false
    if (requirement.notNodeId && current === requirement.notNodeId) return false
    if (requirement.visited !== undefined) {
      const targetId = requirement.nodeId ?? requirement.notNodeId
      const target = targetId ? save.map.find((node) => node.id === targetId) : undefined
      if (!target || Boolean(target.visited) !== requirement.visited) return false
    }
    return true
  }
  if (requirement.type === 'stat') {
    const value = Number(save.stats[requirement.id])
    if (!Number.isFinite(value)) return false
    if (requirement.min !== undefined && value < requirement.min) return false
    if (requirement.max !== undefined && value > requirement.max) return false
    return true
  }
  if (requirement.type === 'item') return (save.inventory.find((item) => item.id === requirement.id)?.count ?? 0) >= requirement.minCount
  if (requirement.type === 'character') {
    const character = save.characters.find((entry) => entry.id === requirement.id)
    return Boolean(character && character.status === requirement.status)
  }
  if (requirement.type === 'danger') return requirement.phases.includes(save.danger.phase)
  const value = save.facts[requirement.id]
  if (requirement.equals !== undefined && value !== requirement.equals) return false
  if (requirement.notEquals !== undefined && value === requirement.notEquals) return false
  if (requirement.min !== undefined && (!(typeof value === 'number') || value < requirement.min)) return false
  if (requirement.max !== undefined && (!(typeof value === 'number') || value > requirement.max)) return false
  return true
}

export function resolveDomainAction(save: StorySave, cartridge: StoryCartridge, action: string): DomainActionResolution | undefined {
  const source = normalized(action)
  if (!source || !cartridge.domainRules?.rules.length) return undefined
  const candidate = cartridge.domainRules.rules
    .map((rule, index) => {
      if (rule.intentGuard === 'rest-commitment' && !isRestCommitment(action)) return null
      const matches = rule.match.map(normalized).map((keyword) => rule.matchMode === 'exact'
        ? source === keyword ? 1000 + keyword.length : 0
        : matchStrength(source, keyword)).filter(Boolean)
      return matches.length ? { rule, index, score: matches.length * 1000 + Math.max(...matches) } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]
  const floor = activeStatFloorRule(save, cartridge)
  if (floor && (!candidate || !floor.rule.allowedDomainRuleIds.includes(candidate.rule.id))) {
    return {
      status: 'rejected',
      ruleId: `stat-floor-${floor.definition.id}`,
      intent: action,
      effects: [],
      reasons: [floor.rule.blockedText],
      successText: floor.rule.blockedText,
      successChoices: [...floor.rule.recoveryChoices],
    }
  }
  if (!candidate) return undefined
  const reasons = candidate.rule.requirements.filter((requirement) => !requirementMet(requirement, save)).map((requirement) => requirement.reason)
  const accepted = reasons.length === 0
  const effects = accepted ? candidate.rule.effects.map((effect) => ({ ...effect })) : []
  if (accepted && candidate.rule.dangerPolicy === 'withdraw' && save.danger.phase !== 'calm') {
    effects.push({ type: 'danger', outcome: 'costly-success' })
  }
  return {
    status: accepted ? 'accepted' : 'rejected',
    ruleId: candidate.rule.id,
    intent: candidate.rule.intent,
    effects,
    reasons,
    successText: candidate.rule.successText,
    dangerPolicy: candidate.rule.dangerPolicy,
    successChoices: [...(reasons.length && candidate.rule.rejectionChoices
      ? candidate.rule.rejectionChoices
      : candidate.rule.successChoices)],
  }
}

export function domainAllowsModelCommand(command: ParsedCommand, resolution?: DomainActionResolution): boolean {
  if (!resolution) return true
  // A governed turn is an atomic local transaction. Letting the model persist
  // even "unrelated" commands can combine two actions (for example repairing
  // the starter and looting the fuel shed) and silently create resources.
  return false
}

export function domainOwnsDanger(resolution?: DomainActionResolution): boolean {
  return Boolean(resolution?.status === 'accepted' && resolution.effects.some((effect) => effect.type === 'danger'))
}

export function domainSuppressesDanger(resolution?: DomainActionResolution): boolean {
  return Boolean(resolution?.status === 'accepted'
    && (resolution.dangerPolicy === 'suppress' || resolution.dangerPolicy === 'withdraw' || domainOwnsDanger(resolution)))
}

function applyInventoryEffect(save: StorySave, effect: Extract<DomainEffect, { type: 'inventory' }>): number {
  const existing = save.inventory.find((item) => item.id === effect.itemId)
  if (effect.action === 'remove') {
    if (!existing) return 0
    const removed = Math.min(existing.count, effect.count)
    existing.count -= removed
    save.inventory = save.inventory.filter((item) => item.count > 0)
    return -removed
  }
  if (existing) {
    existing.count += effect.count
    return effect.count
  }
  if (!effect.item) return 0
  save.inventory.push({
    ...effect.item,
    id: effect.itemId,
    count: effect.count,
    metrics: effect.item.metrics?.map((metric) => ({ ...metric })),
    imageStatus: effect.item.imageUrl ? 'ready' : 'idle',
  })
  return effect.count
}

export function syncDomainDerivedState(save: StorySave, cartridge: StoryCartridge): StorySave {
  cartridge.domainRules?.derivedFacts?.forEach((definition) => {
    const count = definition.itemIds.reduce((total, id) => total + (save.inventory.some((item) => item.id === id && item.count > 0) ? 1 : 0), 0)
    save.facts[definition.factId] = definition.mode === 'owned-item-count' ? count : count >= definition.threshold
  })
  cartridge.domainRules?.derivedItemMetrics?.forEach((definition) => {
    const item = save.inventory.find((entry) => entry.id === definition.itemId)
    if (!item) return
    const used = Number(save.facts[definition.factId] ?? 0)
    const value = definition.mode === 'remaining-from-used' ? String(clamp(definition.maximum - used, 0, definition.maximum)) : '0'
    const metrics = item.metrics?.map((metric) => ({ ...metric })) ?? []
    const existing = metrics.find((metric) => metric.id === definition.metricId || normalized(metric.label) === normalized(definition.label))
    if (existing) {
      existing.id = definition.metricId
      existing.label = definition.label
      existing.value = value
    } else metrics.unshift({ id: definition.metricId, label: definition.label, value })
    item.metrics = metrics
  })
  const objectiveBeforeSync = save.objective
  const objectiveTransition = cartridge.domainRules?.objectiveTransitions?.find((transition) => (
    normalized(transition.from) === normalized(objectiveBeforeSync)
    && transition.requirements.every((requirement) => requirementMet(requirement, save))
  ))
  if (objectiveTransition) save.objective = objectiveTransition.to
  return save
}

export function applyDomainResolution(save: StorySave, cartridge: StoryCartridge, resolution?: DomainActionResolution): StoryBlock[] {
  if (!resolution) return []
  save.choices = resolution.successChoices.map((label, index) => ({ id: `domain-${save.scene}-${index}`, label }))
  if (resolution.status === 'rejected') {
    return [{
      id: `domain-${save.scene}`,
      kind: 'event',
      text: resolution.reasons.join('；'),
      data: { domainRule: resolution.ruleId, domainStatus: 'rejected' },
    }]
  }
  const blocks: StoryBlock[] = []
  const statDeltas = new Map<string, number>()
  resolution.effects.forEach((effect) => {
    if (effect.type === 'stat') statDeltas.set(effect.id, (statDeltas.get(effect.id) ?? 0) + effect.delta)
  })
  statDeltas.forEach((requestedDelta, id) => {
    const definition = cartridge.statDefinitions.find((entry) => entry.id === id)
    if (!definition) return
    const before = save.stats[id] ?? definition.initial
    const registeredMaximum = definition.domainMaxDelta ?? definition.maxDelta
    const maximum = registeredMaximum == null ? Math.abs(requestedDelta) : Math.max(0, registeredMaximum)
    const delta = clamp(requestedDelta, -maximum, maximum)
    const current = clamp(before + delta, definition.min, definition.max)
    save.stats[id] = current
    const applied = current - before
    if (applied) blocks.push({ id: `domain-${save.scene}-stat-${id}`, kind: 'change', text: `${definition.label} ${applied > 0 ? '+' : ''}${applied}`, data: { stat: id, delta: applied, domainRule: resolution.ruleId } })
  })
  resolution.effects.forEach((effect, index) => {
    const id = `domain-${save.scene}-${index}`
    if (effect.type === 'stat') return
    if (effect.type === 'fact') save.facts[effect.id] = effect.value
    if (effect.type === 'fact-add') save.facts[effect.id] = Number(save.facts[effect.id] ?? 0) + effect.delta
    if (effect.type === 'inventory') {
      const delta = applyInventoryEffect(save, effect)
      const verb = cartridge.locale === 'zh' ? (delta > 0 ? '获得' : '消耗') : (delta > 0 ? 'Gained' : 'Consumed')
      if (delta) blocks.push({ id, kind: 'change', text: `${verb} ${effect.item?.label ?? effect.itemId} ×${Math.abs(delta)}`, data: { itemId: effect.itemId, delta, domainRule: resolution.ruleId } })
    }
    if (effect.type === 'party') {
      const character = save.characters.find((entry) => entry.id === effect.characterId)
        ?? cartridge.characters.find((entry) => entry.id === effect.characterId)
      if (!character) return
      let target = save.characters.find((entry) => entry.id === effect.characterId)
      if (!target) {
        target = { ...character, skills: character.skills.map((skill) => ({ ...skill })), status: 'known', origin: 'cartridge', updatedAtScene: save.scene }
        save.characters.push(target)
      }
      if (effect.change === 'add') {
        if (!save.partyMemberIds.includes(target.id)) save.partyMemberIds.push(target.id)
        target.status = 'companion'
        target.joinedAtScene ??= save.scene
        target.leftAtScene = undefined
      } else {
        save.partyMemberIds = save.partyMemberIds.filter((entry) => entry !== target!.id)
        target.status = 'departed'
        target.leftAtScene = save.scene
      }
      target.updatedAtScene = save.scene
    }
    if (effect.type === 'map') {
      const target = save.map.find((node) => node.id === effect.nodeId)
      if (!target) return
      save.map.forEach((node) => { node.current = node.id === target.id })
      target.visited = true
      save.location = target.label
      save.sceneLocation = target.label
      blocks.push({ id, kind: 'event', text: `${cartridge.locale === 'zh' ? '抵达' : 'Arrived at'} ${target.label}`, data: { mapId: target.id, domainRule: resolution.ruleId } })
    }
    if (effect.type === 'danger') {
      save.danger = {
        phase: 'calm', safeTurns: 0, cycle: save.danger.cycle + 1,
        cooldownTurns: cartridge.dangerDirector?.cooldownTurns ?? 0,
        severity: 1, lastOutcome: effect.outcome, lastResolvedScene: save.scene,
      }
    }
    if (effect.type === 'objective') save.objective = effect.value
    if (effect.type === 'clock') save.time = effect.value
    if (effect.type === 'clock-add') advanceClock(save, effect.minutes, cartridge.locale)
    if (effect.type === 'session') {
      save.sessionEnded = effect.ended
      if (effect.reason) blocks.push({ id, kind: 'summary', text: effect.reason, data: { domainRule: resolution.ruleId } })
    }
  })
  syncDomainDerivedState(save, cartridge)
  blocks.push({ id: `domain-${save.scene}`, kind: 'event', text: resolution.successText, data: { domainRule: resolution.ruleId, domainStatus: 'accepted' } })
  return blocks
}

export function domainDirectiveContract(resolution?: DomainActionResolution): string {
  if (!resolution) return ''
  if (resolution.status === 'rejected') return `
LOCAL DOMAIN ADJUDICATION IS AUTHORITATIVE. The attempted action maps to intent "${resolution.intent}" but is illegal now: ${resolution.reasons.join(' / ')}. Narrate the concrete in-world obstruction without turning it into success. Do not emit any state-changing protocol command. End with the currently feasible choices.`
  const effectSummary = resolution.effects.map((effect) => JSON.stringify(effect)).join(' | ')
  return `
LOCAL DOMAIN ADJUDICATION IS AUTHORITATIVE. The attempted action maps to intent "${resolution.intent}" and has already been accepted. The local reducer, not you, owns this entire turn's persistent state transaction: ${effectSummary}. Narrate the visible consequence consistently. Do not emit widget, fact, inventory, map, party, encounter, state, clock, ending, or session commands. End with the feasible choices.`
}

export function domainDemoContent(resolution: DomainActionResolution): string {
  const body = resolution.status === 'accepted' ? resolution.successText : resolution.reasons.join('；')
  return `${body}\n[choices: ${resolution.successChoices.slice(0, 5).map((choice) => `"${choice.replaceAll('"', '\\"')}"`).join('|')}]`
}
