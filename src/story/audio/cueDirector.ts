import type { StoryBlock } from '../types'
import type { StoryAudioCue } from './StorySynth'

function number(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function chooseStoryAudioCue(blocks: StoryBlock[]): StoryAudioCue | null {
  if (blocks.some((block) => block.kind === 'summary')) return 'summary'

  const check = blocks.find((block) => block.kind === 'check')
  if (check) {
    const outcome = String(check.data?.outcome ?? '')
    return /critical-success|costly-success|success/i.test(outcome) ? 'success' : 'failure'
  }

  const arrival = blocks.find((block) => block.kind === 'event' && block.data?.arrival)
  if (arrival) return 'travel'

  const rareItem = blocks.find((block) => block.kind === 'change' && (block.data?.rarity === 'rare' || block.data?.rarity === 'legendary'))
  if (rareItem) return 'treasure'

  const relationship = blocks.find((block) => block.data?.relationshipChange || block.data?.partyChange)
  if (relationship) return 'relationship'

  const item = blocks.find((block) => block.kind === 'change' && block.data?.itemAction)
  if (item) return 'item'

  const stat = blocks.find((block) => block.kind === 'change' && block.data?.stat)
  if (stat?.data?.stat === 'coin') return number(stat.data.delta) >= 0 ? 'coinGain' : 'coinSpend'
  if (stat?.data?.stat === 'energy') return 'energy'
  if (stat?.data?.stat === 'renown') return 'standing'
  if (stat) return 'change'

  if (blocks.some((block) => block.kind === 'event' && !block.id.startsWith('action-'))) return 'discovery'
  return null
}
