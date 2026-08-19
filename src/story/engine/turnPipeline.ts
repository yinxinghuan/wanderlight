import type { DangerDirective, ParsedScene, StoryCartridge, StorySave } from '../types'
import { canonicalizePaymentMetadata, validatePaymentConsistency } from './paymentConsistency'
import { canCommitGeneratedTurnWithoutReplies, canonicalizeTurnMetadata, validateTurnConsistency } from './turnConsistency'
import { canonicalizeVisibleDangerDirective } from './dangerDirector'

export interface PreparedTurnCandidate {
  parsed: ParsedScene
  imagePrompt?: string
  dangerDirective?: DangerDirective
  discardedImage: boolean
  paymentViolations: string[]
  turnViolations: string[]
  violations: string[]
  canCommitWithoutReplies: boolean
  repairedDangerMetadata: boolean
}

/**
 * One canonical boundary for AI/authored turn drafts. Nothing may reach the
 * reducer until payment intent, location/image binding and feasible replies
 * have all been normalized and validated against the same pre-turn save.
 */
export function prepareTurnCandidate(options: {
  save: StorySave
  parsed: ParsedScene
  cartridge: StoryCartridge
  action: string
  imagePrompt?: string
  dangerDirective?: DangerDirective
  trustedAuthored?: boolean
  skipTurnValidation?: boolean
}): PreparedTurnCandidate {
  const paymentSafe = canonicalizePaymentMetadata(options.save, options.parsed, options.cartridge, options.action)
  const canonical = canonicalizeTurnMetadata(
    options.save,
    paymentSafe,
    options.cartridge,
    options.imagePrompt,
    options.action,
    options.trustedAuthored,
  )
  const dangerSafe = canonicalizeVisibleDangerDirective(canonical.parsed, options.dangerDirective, options.cartridge.locale)
  const paymentViolations = validatePaymentConsistency(options.save, dangerSafe.parsed, options.cartridge, options.action)
  const turnViolations = options.skipTurnValidation && !options.dangerDirective
    ? []
    : validateTurnConsistency(options.save, dangerSafe.parsed, options.cartridge, canonical.imagePrompt, options.action, options.dangerDirective)
  const violations = [...paymentViolations, ...turnViolations]
  return {
    parsed: dangerSafe.parsed,
    imagePrompt: canonical.imagePrompt,
    dangerDirective: options.dangerDirective,
    discardedImage: canonical.discardedImage,
    paymentViolations,
    turnViolations,
    violations,
    canCommitWithoutReplies: canCommitGeneratedTurnWithoutReplies(violations),
    repairedDangerMetadata: dangerSafe.repaired,
  }
}
