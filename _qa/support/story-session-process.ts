import { wanderlight } from '../../src/story/cartridges/wanderlight'
import { createStorySessionLab } from '../../server/storySessionLab'

const releases = new Map<string, () => void>()
const service = createStorySessionLab({
  cartridge: wanderlight,
  databasePath: process.argv[2],
  actorTokens: { 'qa-process-a': 'owner-a', 'qa-process-b': 'owner-b' },
  generator: { async send(): Promise<never> { throw new Error('INJECTED_MODEL_OUTAGE') } },
  failBeforeCommit: ['rollback-action'],
  dropResponseAfterCommit: ['lost-before-restart'],
  beforeCommit(actionId) {
    if (!actionId.startsWith('race-')) return Promise.resolve()
    return new Promise<void>((resolve) => { releases.set(actionId, resolve); process.send?.({ type: 'prepared', actionId }) })
  },
})

process.on('message', async (message: { type: string; actionId?: string }) => {
  if (message.type === 'release' && message.actionId) { releases.get(message.actionId)?.(); releases.delete(message.actionId) }
  if (message.type === 'close') { await service.close(); process.disconnect() }
})
process.send?.({ type: 'ready', ...(await service.listen()) })


