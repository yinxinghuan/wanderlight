import { strict as assert } from 'node:assert'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { applyDomainRecommendationPolicy, auditDomainChoiceAuthority, enumerateRecommendedDomainChoices, resolveDomainAction } from '../src/story/engine/domainRules'
import { createInitialSave } from '../src/story/engine/reducer'

const save = createInitialSave(wanderlight)
const visibleBefore = save.choices.map((choice) => ({ ...choice }))
const audit = auditDomainChoiceAuthority(save, wanderlight, save.choices)

assert.equal(wanderlight.domainRules?.authorityMode, 'shadow')
assert.deepEqual(save.choices, visibleBefore, 'shadow audit must not alter player-visible choices')
assert.ok(audit.authorityChoices.length >= 2, 'opening should expose multiple executable authority candidates')
assert.equal(audit.authorityChoices.every((choice) => resolveDomainAction(save, wanderlight, choice.label)?.status === 'accepted'), true)

const staleShift = {
  ...save,
  facts: {
    ...save.facts,
    [`domain-repeat:local-shift:${save.map.find((node) => node.current)?.id ?? 'unknown-place'}:day-1`]: true,
  },
}
assert.equal(enumerateRecommendedDomainChoices(staleShift, wanderlight).some((choice) => /短工|job/i.test(choice.label)), false,
  'repeat-limited work must disappear from authority candidates')

const danger = {
  ...save,
  danger: { ...save.danger, phase: 'confrontation' as const, currentThreat: 'test threat' },
}
assert.equal(enumerateRecommendedDomainChoices(danger, wanderlight).length, 0,
  'calm economy and recovery rules must not interrupt an active confrontation')

const openAudit = auditDomainChoiceAuthority(save, wanderlight, [{ id: 'open', label: '问援夕刚才听见了什么' }])
assert.equal(openAudit.narrativeChoices[0]?.status, 'open-narrative')

const canary = { ...wanderlight, domainRules: { ...wanderlight.domainRules!, authorityMode: 'authority-first' as const } }
const staleWorkLabel = canary.domainRules.rules.find((rule) => rule.id === 'local-shift')!.choiceLabel!
const openChoice = { id: 'open', label: '问援夕刚才听见了什么' }
assert.deepEqual(
  applyDomainRecommendationPolicy(staleShift, canary, [{ id: 'stale', label: staleWorkLabel }, openChoice]),
  [openChoice],
  'authority-first must remove a governed-stale choice and preserve open narrative',
)
assert.deepEqual(applyDomainRecommendationPolicy(staleShift, canary, [{ id: 'stale', label: staleWorkLabel }]), [],
  'default all-stale policy must defer to contextual story recovery instead of installing a fixed mechanics menu')
const explicitFallbackCanary = {
  ...canary,
  domainRules: { ...canary.domainRules, authorityFallbackLimit: 2 },
}
const fallback = applyDomainRecommendationPolicy(staleShift, explicitFallbackCanary, [{ id: 'stale', label: staleWorkLabel }])
assert.ok(fallback.length === 2 && fallback.every((choice) => choice.label !== staleWorkLabel),
  'an explicitly configured fallback may use only executable authority actions')

console.log(JSON.stringify({
  passed: true,
  mode: audit.mode,
  visibleChoices: visibleBefore.length,
  authorityChoices: audit.authorityChoices.length,
  assertions: [
    'shadow-does-not-change-rendered-choices',
    'authority-candidates-are-executable',
    'repeat-limited-action-disappears',
    'calm-rules-do-not-interrupt-danger',
    'open-narrative-remains-open',
    'authority-first-removes-governed-stale-choice',
    'authority-first-preserves-open-narrative',
    'authority-first-defaults-to-contextual-story-recovery',
    'authority-first-explicit-fallback-is-executable',
  ],
}, null, 2))
