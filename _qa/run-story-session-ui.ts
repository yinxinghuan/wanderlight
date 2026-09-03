import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { createStorySessionLab } from '../server/storySessionLab'
import { resolveCartridge } from '../src/story/cartridges'

const gameBase = '/66263f04-c6a5-4290-85f2-1011bbccf697'
const directory = resolve(process.env.STORY_LAB_UI_DATABASE_DIR ?? '.story-session-lab/ui'); await mkdir(directory, { recursive: true })
const faults = { apiUnavailable: false, dropAndBlock: false }
let modelCalls = 0
const services = new Map<string, ReturnType<typeof createStorySessionLab>>(); const bases = new Map<string, string>()
for (const locale of ['zh','en'] as const) {
  const service = createStorySessionLab({ cartridge: resolveCartridge(null, locale), databasePath: resolve(directory, `${locale}.sqlite`), actorTokens: { 'qa-ui-a':'qa-ui-a','qa-ui-b':'qa-ui-b' }, generator: { async send(_action, context) { modelCalls += 1; return { content: locale === 'zh' ? `你们把月线地图铺在车厢灯下，萤火航线与林间旧路标重合。\n[state: value="确认萤火航线与林间路标"]\n[scene_location: location="${context.save.sceneLocation ?? context.save.location}"]\n[choices: "请媛夕标出旧路"|"沿萤火航线前进"]` : `You spread the Moonline map under the carriage lamp. The firefly route overlaps the old forest markers.\n[state: value="Verify the firefly route and forest markers"]\n[scene_location: location="${context.save.sceneLocation ?? context.save.location}"]\n[choices: "Ask Mira to mark the old route"|"Follow the firefly route"]` } } } })
  services.set(locale, service); bases.set(locale, (await service.listen()).baseUrl)
}
const vite = await createServer({ configFile: resolve('vite.config.ts'), server: { host:'127.0.0.1', port:Number(process.env.STORY_LAB_UI_PORT ?? 5190), strictPort:true }, plugins:[{ name:'wanderlight-story-session-qa-only', configureServer(server) { server.middlewares.use(async (request,response,next) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  if (!path.startsWith('/__story_lab/') && !path.startsWith(`${gameBase}/api/story/`)) { next(); return }
  response.setHeader('Cache-Control','no-store')
  try {
    const chunks:Buffer[]=[]; for await (const chunk of request) chunks.push(Buffer.from(chunk)); const requestBody=Buffer.concat(chunks).toString('utf8')
    if (path === '/__story_lab/control' && request.method === 'POST') { const update=JSON.parse(requestBody); if(typeof update.apiUnavailable==='boolean') faults.apiUnavailable=update.apiUnavailable; if(typeof update.dropAndBlock==='boolean') faults.dropAndBlock=update.dropAndBlock; response.setHeader('Content-Type','application/json'); response.end(JSON.stringify({ok:true,faults})); return }
    if (path === '/__story_lab/status' && request.method === 'GET') { response.setHeader('Content-Type','application/json'); response.end(JSON.stringify({ modelCalls, commits:Object.fromEntries([...services].map(([key,value])=>[key,value.committedCount()])), liveModelCalled:false, productionWrites:false, faults })); return }
    if (faults.apiUnavailable) { response.statusCode=503; response.end(JSON.stringify({code:'LAB_API_OFFLINE'})); return }
    const locale=request.headers['x-story-lab-locale']==='en'?'en':'zh'; const actor=request.headers['x-story-lab-actor']==='qa-b'?'qa-ui-b':'qa-ui-a'; const route=(request.url ?? '').slice(gameBase.length)
    const result=await fetch(`${bases.get(locale)}${route}`,{method:request.method,headers:{Authorization:`Bearer ${actor}`,'Content-Type':'application/json'},body:request.method==='GET'?undefined:requestBody}); const payload=await result.text()
    if(result.ok && path.endsWith('/turns') && faults.dropAndBlock){faults.dropAndBlock=false;faults.apiUnavailable=true;response.destroy();return}
    response.statusCode=result.status;response.setHeader('Content-Type','application/json');response.end(payload)
  } catch { response.statusCode=500; response.end(JSON.stringify({code:'LAB_PROXY_FAILURE'})) }
}) } }] })
await vite.listen(); console.log(JSON.stringify({url:`http://127.0.0.1:${vite.config.server.port}/_qa/story-session.html`,model:'fixture-only',productionWrites:false}))
let closing=false; for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>{if(closing)return;closing=true;void(async()=>{await vite.close();await Promise.all([...services.values()].map(service=>service.close()))})()})


