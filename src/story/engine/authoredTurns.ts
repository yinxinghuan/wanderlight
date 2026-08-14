import type { DemoTurn, StoryCartridge, StorySave } from '../types'

export function resolveDeterministicOpeningTurn(
  save: Pick<StorySave, 'scene' | 'choices'>,
  cartridge: StoryCartridge,
  action: string,
): DemoTurn | undefined {
  if (save.scene !== 0 || !cartridge.opening.deterministicTurns) return undefined
  const selected = save.choices.find((choice) => choice.label === action)
  return selected ? cartridge.opening.deterministicTurns[selected.id] : undefined
}
