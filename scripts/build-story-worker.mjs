import { build } from 'esbuild'

await build({
  entryPoints: ['worker/source.ts'],
  outfile: 'worker/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['cloudflare:workers'],
  target: 'es2022',
  // Cartridge modules declare browser-only asset URLs with import.meta.url.
  // The authority never serves those assets, but Cloudflare still evaluates
  // module initializers, so give the worker bundle a valid inert base URL.
  define: { 'import.meta.url': '"https://story-session.invalid/worker/index.js"' },
  legalComments: 'none',
  sourcemap: false,
})
