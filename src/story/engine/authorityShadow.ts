import type { DomainChoiceAuthorityAudit, StoryCartridge, StorySave } from '../types'
import { auditDomainChoiceAuthority } from './domainRules'

export interface AuthorityShadowSample extends DomainChoiceAuthorityAudit {
  scene: number
  location: string
  objective: string
  dangerPhase: StorySave['danger']['phase']
}

declare global {
  interface Window {
    __WANDERLIGHT_AUTHORITY_CANARY__?: AuthorityShadowSample
  }
}

/**
 * QA-only, in-memory shadow evidence. It is enabled with `?authority_shadow=1`,
 * never changes choices, never enters the save, and never sends data remotely.
 */
export function recordAuthorityShadowSample(save: StorySave, cartridge: StoryCartridge): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const isShadow = cartridge.domainRules?.authorityMode === 'shadow' && params.get('authority_shadow') === '1'
  const isCanary = cartridge.domainRules?.authorityMode === 'authority-first' && params.get('authority_first') === '1'
  if (!isShadow && !isCanary) return
  const target = window as unknown as { __WANDERLIGHT_AUTHORITY_SHADOW__?: AuthorityShadowSample[] }
  const sample: AuthorityShadowSample = {
    ...auditDomainChoiceAuthority(save, cartridge, save.choices),
    scene: save.scene,
    location: save.location,
    objective: save.objective,
    dangerPhase: save.danger.phase,
  }
  if (isCanary) {
    window.__WANDERLIGHT_AUTHORITY_CANARY__ = sample
    return
  }
  const previous = target.__WANDERLIGHT_AUTHORITY_SHADOW__ ?? []
  const duplicate = previous.at(-1)
  if (duplicate?.scene === sample.scene
    && duplicate.location === sample.location
    && JSON.stringify(duplicate.narrativeChoices) === JSON.stringify(sample.narrativeChoices)) return
  target.__WANDERLIGHT_AUTHORITY_SHADOW__ = [...previous, sample].slice(-100)
}
