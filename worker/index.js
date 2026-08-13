/**
 * Minimal AlterU deployment adapter for Wanderlight.
 *
 * The deployment package serves the compiled `dist/` beside this handler.
 * Player identity, saves, narration, and generated media remain on AlterU
 * platform services; this worker deliberately creates no second data layer.
 */
export async function handleApi(request) {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return Response.json({
      ok: true,
      game: 'wanderlight',
      world: 'persistent-open-world',
      version: '1.0.0',
    })
  }

  return new Response('Not Found', { status: 404 })
}
