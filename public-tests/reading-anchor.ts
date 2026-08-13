import { latestReadingAnchorId } from '../src/story/engine/readingAnchor'
import type { StoryBlock } from '../src/story/types'

function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const blocks: StoryBlock[] = [
  { id: 'opening', kind: 'narration', text: '你在码头醒来。' },
  { id: 'action-1', kind: 'event', text: '询问今晚的工作。' },
  { id: 'result-1', kind: 'narration', text: '招工人指向正在卸货的月线。' },
  { id: 'image-1', kind: 'image', text: '', data: { status: 'ready' } },
  { id: 'change-1', kind: 'change', text: '钱币增加。' },
  { id: 'choices-1', kind: 'choices', text: '["报名卸货","继续询问","观察周围"]' },
]

equal(latestReadingAnchorId(blocks), 'action-1', 'resume begins at the latest player action so its consequence remains visible')
equal(latestReadingAnchorId(blocks.slice(0, 1)), 'opening', 'opening prose is the fallback before the first action')
equal(latestReadingAnchorId([{ id: 'image-only', kind: 'image', text: '' }]), undefined, 'image-only histories do not invent an anchor')

console.log(JSON.stringify({ ok: true, checks: ['latest-action-context', 'opening-fallback', 'no-invented-anchor'] }))
