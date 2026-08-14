import type { DemoTurn, StoryCartridge, StorySave } from '../types'

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function resolveDeterministicOpeningTurn(
  save: Pick<StorySave, 'scene' | 'choices'>,
  cartridge: StoryCartridge,
  action: string,
): DemoTurn | undefined {
  if (save.scene !== 0 || !cartridge.opening.deterministicTurns) return undefined
  const selected = save.choices.find((choice) => choice.label === action)
  return selected ? cartridge.opening.deterministicTurns[selected.id] : undefined
}

export function resolveDeterministicChoiceTurn(
  save: Pick<StorySave, 'choices' | 'location' | 'characters' | 'jobs'>,
  cartridge: StoryCartridge,
  action: string,
  options: { requireVisibleChoice?: boolean } = {},
): DemoTurn | undefined {
  const actionKey = normalized(action)
  if (!actionKey || (options.requireVisibleChoice !== false && !save.choices.some((choice) => normalized(choice.label) === actionKey))) return undefined
  const rule = cartridge.deterministicChoiceTurns?.find((candidate) => {
    if (normalized(candidate.action) !== actionKey) return false
    const when = candidate.when
    if (when?.locations?.length && !when.locations.some((location) => normalized(location) === normalized(save.location))) return false
    if (when?.characterIds?.some((id) => !save.characters.some((character) => character.id === id))) return false
    if (when?.jobs?.some((requirement) => !save.jobs.some((job) => job.id === requirement.id && (!requirement.statuses?.length || requirement.statuses.includes(job.status))))) return false
    return true
  })
  return rule?.turn
}
