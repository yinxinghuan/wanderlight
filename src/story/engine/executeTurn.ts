import type { AdapterContext, AdapterResult, Locale, StoryCartridge, StorySave } from '../types'
import {
  applyConsistencyRecovery,
  applyConsistencyRecoverySelection,
  applyDisplayedRouteFallback,
  applyParsedScene,
  resolveConsistencyRecoverySelection,
} from './reducer'
import { parseStoryProtocol } from './protocol'
import {
  canCommitDisplayedChoiceWithoutGeneratedReplies,
  inferActionDestination,
} from './turnConsistency'
import { prepareTurnCandidate } from './turnPipeline'
import {
  buildDangerDirective,
  createDangerFallbackScene,
  resolveActiveDangerDeflection,
} from './dangerDirector'
import {
  domainSuppressesDanger,
  resolveDomainAction,
} from './domainRules'
import {
  resolveDeterministicChoiceTurn,
  resolveDeterministicOpeningTurn,
} from './authoredTurns'
import { resolvePresetEventTurn } from './presetEventDirector'

export interface StoryTurnGenerator {
  send(action: string, context: AdapterContext): Promise<AdapterResult>
}

export interface ExecutedStoryTurn {
  save: StorySave
  source: 'domain' | 'authored' | 'model' | 'local-recovery'
  repaired: boolean
}

/**
 * Server-compatible turn pipeline. It owns the same deterministic validation
 * and reducer boundary as the React hook, but has no React, DOM, media, storage,
 * or transport dependency. A Story Session authority can call this function
 * inside its serialized owner transaction and persist only the returned save.
 */
export async function executeStoryTurn(options: {
  save: StorySave
  cartridge: StoryCartridge
  action: string
  locale?: Locale
  generator: StoryTurnGenerator
}): Promise<ExecutedStoryTurn> {
  const action = options.action.trim()
  if (!action) throw new Error('Story action is required')
  const cartridge = options.cartridge
  const locale = options.locale ?? cartridge.locale
  const base = options.save
  const commit = (
    parsed: ReturnType<typeof parseStoryProtocol>,
    result: AdapterResult,
    dangerDirective: ReturnType<typeof buildDangerDirective>,
    domainResolution: ReturnType<typeof resolveDomainAction>,
    presetEventResolution: ReturnType<typeof resolvePresetEventTurn>,
    suppressSceneImage = false,
  ) => applyParsedScene(
    base,
    parsed,
    cartridge,
    action,
    result.imagePrompt,
    result.imageSubject,
    dangerDirective,
    domainResolution,
    result.imageCharacterId,
    presetEventResolution,
    suppressSceneImage,
  )

  const selectedChoice = base.choices.find((choice) => choice.label.trim() === action)
  const displayedRouteDestination = selectedChoice
    ? (selectedChoice.targetLocationId
        ? base.map.find((node) => node.id === selectedChoice.targetLocationId)
          ?? cartridge.initialMap.find((node) => node.id === selectedChoice.targetLocationId)
        : undefined)
      ?? inferActionDestination(base, cartridge, action)
    : undefined
  const recoverySelection = resolveConsistencyRecoverySelection(base, cartridge, action)
  if (recoverySelection) {
    return {
      save: applyConsistencyRecoverySelection(base, cartridge, action, recoverySelection),
      source: 'local-recovery',
      repaired: false,
    }
  }

  const domainResolution = resolveDomainAction(base, cartridge, action)
  const activeDangerDeflection = domainResolution ? undefined : resolveActiveDangerDeflection(base, cartridge, action)
  const authoredOpening = domainResolution || activeDangerDeflection ? undefined : resolveDeterministicOpeningTurn(base, cartridge, action)
  const authoredChoice = domainResolution || activeDangerDeflection || authoredOpening ? undefined : resolveDeterministicChoiceTurn(base, cartridge, action)
  const authoredOwnsCalmTurn = base.danger.phase === 'calm' && Boolean(authoredOpening || authoredChoice)
  const scheduledDanger = activeDangerDeflection
    || domainResolution?.status === 'rejected'
    || domainSuppressesDanger(domainResolution)
    || authoredOwnsCalmTurn
    ? undefined
    : buildDangerDirective(base, cartridge, action)
  const presetEvent = domainResolution || authoredOpening || authoredChoice || scheduledDanger
    ? undefined
    : resolvePresetEventTurn(base, cartridge, action)
  const authored = activeDangerDeflection ?? authoredOpening ?? authoredChoice ?? presetEvent?.turn
  const dangerDirective = presetEvent ? undefined : scheduledDanger
  let source: ExecutedStoryTurn['source'] = domainResolution ? 'domain' : authored ? 'authored' : 'model'
  let result: AdapterResult = domainResolution
    ? { content: domainResolution.status === 'accepted' ? domainResolution.successText : domainResolution.reasons.join(locale === 'zh' ? '；' : '; ') }
    : authored
      ? { content: authored.content, imagePrompt: authored.imagePrompt, imageSubject: authored.imageSubject, imageCharacterId: authored.imageCharacterId }
      : await options.generator.send(action, { cartridge, save: base, actionId: action, locale, dangerDirective })
  let parsed = domainResolution?.status === 'accepted'
    && domainResolution.dangerPolicy === 'advance'
    && dangerDirective
    ? createDangerFallbackScene(base, cartridge, dangerDirective)
    : parseStoryProtocol(result.content, locale)
  let repaired = false

  if (!domainResolution) {
    let prepared = prepareTurnCandidate({
      save: base,
      parsed,
      cartridge,
      action,
      imagePrompt: result.imagePrompt,
      dangerDirective,
      trustedAuthored: Boolean(authored),
    })
    parsed = prepared.parsed
    if (prepared.discardedImage) result = { ...result, imagePrompt: undefined, imageSubject: undefined, imageCharacterId: undefined }
    if (prepared.violations.length) {
      if (authored) throw new Error(`invalid deterministic turn: ${prepared.violations.join(', ')}`)
      if (prepared.canCommitWithoutReplies) return { save: commit(parsed, result, dangerDirective, undefined, presetEvent, Boolean(activeDangerDeflection?.suppressImage)), source, repaired }
      repaired = true
      result = await options.generator.send(action, {
        cartridge,
        save: base,
        actionId: action,
        locale,
        dangerDirective,
        repair: { draft: result.content, violations: prepared.violations },
      })
      parsed = parseStoryProtocol(result.content, locale)
      prepared = prepareTurnCandidate({
        save: base,
        parsed,
        cartridge,
        action,
        imagePrompt: result.imagePrompt,
        dangerDirective,
      })
      parsed = prepared.parsed
      if (prepared.discardedImage) result = { ...result, imagePrompt: undefined, imageSubject: undefined, imageCharacterId: undefined }
      if (prepared.violations.length) {
        if (
          prepared.canCommitWithoutReplies
          || canCommitDisplayedChoiceWithoutGeneratedReplies(base, cartridge, action, prepared.violations)
        ) return { save: commit(parsed, result, dangerDirective, undefined, presetEvent, Boolean(activeDangerDeflection?.suppressImage)), source, repaired }
        if (dangerDirective) {
          return {
            save: applyParsedScene(base, createDangerFallbackScene(base, cartridge, dangerDirective), cartridge, action, undefined, undefined, dangerDirective),
            source: 'local-recovery',
            repaired,
          }
        }
        if (displayedRouteDestination && base.danger.phase === 'calm') {
          return {
            save: applyDisplayedRouteFallback(base, cartridge, action, displayedRouteDestination),
            source: 'local-recovery',
            repaired,
          }
        }
        return { save: applyConsistencyRecovery(base, cartridge, action), source: 'local-recovery', repaired }
      }
    }
  }

  return { save: commit(parsed, result, dangerDirective, domainResolution, presetEvent, Boolean(activeDangerDeflection?.suppressImage)), source, repaired }
}
