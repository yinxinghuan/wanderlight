import type { StoryBlock } from '../types'

function isPlayerAction(block: StoryBlock): boolean {
  return block.kind === 'event' && block.id.startsWith('action-')
}

function isReadableContext(block: StoryBlock): boolean {
  return block.kind !== 'image' && block.kind !== 'change' && block.kind !== 'choices'
}

export function latestReadingAnchorId(blocks: StoryBlock[]): string | undefined {
  let latestChoiceIndex = -1
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index].kind === 'choices') { latestChoiceIndex = index; break }
  }
  const beforeCurrentChoices = latestChoiceIndex >= 0 ? blocks.slice(0, latestChoiceIndex) : blocks
  for (let index = beforeCurrentChoices.length - 1; index >= 0; index -= 1) {
    if (isPlayerAction(beforeCurrentChoices[index])) return beforeCurrentChoices[index].id
  }
  for (let index = beforeCurrentChoices.length - 1; index >= 0; index -= 1) {
    if (isReadableContext(beforeCurrentChoices[index])) return beforeCurrentChoices[index].id
  }
  return undefined
}
