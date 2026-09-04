import { resolveCartridge } from '../src/story/cartridges'
import { aigramAdapter } from '../src/story/adapters/aigram'
import { executeStoryTurn } from '../src/story/engine/executeTurn'
import { normalizeSave } from '../src/story/useStoryEngine'
import { createStorySessionRuntime } from './storySessionRuntime'

const runtime = createStorySessionRuntime({
  gameId: 'wanderlight',
  resolveCartridge: locale => resolveCartridge(null, locale),
  normalizeSave,
  executeTurn: executeStoryTurn as any,
  generator: aigramAdapter,
})

export const StorySessionAuthority = runtime.StorySessionAuthority

export async function handleApi(request: Request, env: any) {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/story/')) return runtime.handleStoryApi(request, env)
  if (request.method === 'GET' && url.pathname === '/api/health') return Response.json({ ok: true, game: 'wanderlight', story_session: 'anonymous-capability-v1' })
  return new Response('Not Found', { status: 404 })
}
