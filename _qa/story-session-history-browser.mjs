import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'); const databaseDirectory=await mkdtemp(join(tmpdir(),'wanderlight-history-ui-')); const evidenceDirectory=resolve(root,'_qa/ui'); await mkdir(evidenceDirectory,{recursive:true})
const child=spawn(process.execPath,['--import','tsx','_qa/run-story-session-ui.ts'],{cwd:root,env:{...process.env,STORY_LAB_UI_DATABASE_DIR:databaseDirectory,STORY_LAB_UI_PORT:'5190'},stdio:['ignore','pipe','pipe']})
let serverLog=''; child.stderr.on('data',chunk=>{serverLog+=String(chunk)})
const ready=new Promise((resolveReady,rejectReady)=>{let buffer='';const timeout=setTimeout(()=>rejectReady(new Error(`UI lab timeout\n${serverLog}`)),20_000);child.stdout.on('data',chunk=>{buffer+=String(chunk);for(const line of buffer.split('\n'))try{const value=JSON.parse(line);if(value?.url){clearTimeout(timeout);resolveReady(value.url);return}}catch{}});child.once('exit',code=>{clearTimeout(timeout);rejectReady(new Error(`UI lab exited ${code}\n${serverLog}`))})})
let browser
const stopChild=async()=>{if(child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise(resolveExit=>child.once('exit',resolveExit)),new Promise(resolveTimeout=>setTimeout(resolveTimeout,5_000))]);if(child.exitCode===null)child.kill('SIGKILL')}
try{
  const labUrl=await ready; const origin=new URL(labUrl).origin; browser=await chromium.launch({headless:true})
  const output=page=>page.locator('output[data-story-session-test]')
  const waitIdle=async page=>{await output(page).waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('output[data-story-session-test]')?.getAttribute('data-busy')==='false')}
  const enter=async page=>{const button=page.locator('button.st-primary');if(await button.count())await button.click()}
  const openHistory=async page=>{await page.locator('button.st-world-button').click();await page.locator('.st-drawer-tabs button').last().click();await page.locator('.st-log button').last().click();await page.locator('.st-session-history__list button').first().waitFor()}
  const actFirst=async page=>{await page.locator('.st-quick-replies button').first().click();await waitIdle(page)}
  const control=update=>fetch(`${origin}/__story_lab/control`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(update)})

  const wide=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}); const page=await wide.newPage(); await page.goto(`${labUrl}?run=history&actor=qa-a&lang=zh`);await waitIdle(page);const original=await output(page).getAttribute('data-session-id');await enter(page);await openHistory(page);assert.equal(await page.locator('.st-session-history__list button').count(),1)
  await page.locator('.st-world-restart__open').click();await page.locator('.st-world-restart__confirm .is-danger').click();await page.waitForFunction(previous=>document.querySelector('output[data-story-session-test]')?.getAttribute('data-session-id')!==previous,original);await waitIdle(page);const restarted=await output(page).getAttribute('data-session-id');assert.notEqual(restarted,original);await enter(page);await openHistory(page)
  const rows=page.locator('.st-session-history__list button');assert.equal(await rows.count(),2);for(let i=0;i<await rows.count();i++){const box=await rows.nth(i).boundingBox();assert.ok(box&&box.height>=44&&box.width>=44)}
  await page.locator('.st-session-history').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:join(evidenceDirectory,'platform-layout-wanderlight-session-history-zh-390x844.png'),fullPage:true});await page.locator('.st-session-history__list button:not([aria-current="true"])').click();await page.waitForFunction(expected=>document.querySelector('output[data-story-session-test]')?.getAttribute('data-session-id')===expected,original);await waitIdle(page)

  const recovery=await wide.newPage();await recovery.goto(`${labUrl}?run=recovery&actor=qa-a&lang=zh`);await waitIdle(recovery);await enter(recovery);await control({dropAndBlock:true});await recovery.locator('.st-quick-replies button').first().click();await recovery.waitForFunction(()=>document.querySelector('output[data-story-session-test]')?.getAttribute('data-busy')==='false');assert.equal(await output(recovery).getAttribute('data-blocked'),'true');assert.ok(await output(recovery).getAttribute('data-pending-id'));const committedVersion=await output(recovery).getAttribute('data-version');assert.equal(committedVersion,'0','unknown response must not optimistically render')
  await recovery.reload();await waitIdle(recovery);assert.equal(await output(recovery).getAttribute('data-blocked'),'true');assert.ok(await output(recovery).getAttribute('data-pending-id'));await control({apiUnavailable:false});await recovery.locator('[data-story-error] button').click();await recovery.waitForFunction(()=>document.querySelector('output[data-story-session-test]')?.getAttribute('data-blocked')==='false');await waitIdle(recovery);assert.equal(await output(recovery).getAttribute('data-version'),'1');assert.equal(await output(recovery).getAttribute('data-pending-id'),'')

  const actorB=await wide.newPage();await actorB.goto(`${labUrl}?run=history&actor=qa-b&lang=zh`);await waitIdle(actorB);await enter(actorB);await openHistory(actorB);assert.equal(await actorB.locator('.st-session-history__list button').count(),1);assert.notEqual(await output(actorB).getAttribute('data-session-id'),original)
  const narrow=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:1});const english=await narrow.newPage();await english.goto(`${labUrl}?run=history&actor=qa-a&lang=en`);await waitIdle(english);await enter(english);await openHistory(english);assert.equal(await english.locator('.st-session-history').getByText('Saved journeys').count(),1);assert.equal(await english.locator('.st-session-history__list button').count(),1);assert.equal(await english.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await english.locator('.st-session-history').evaluate(node=>node.scrollIntoView({block:'start'}));await english.screenshot({path:join(evidenceDirectory,'platform-layout-wanderlight-session-history-en-320x568.png'),fullPage:true})
  const status=await (await fetch(`${origin}/__story_lab/status`)).json();assert.equal(status.liveModelCalled,false);assert.equal(status.productionWrites,false);assert.equal(status.commits.zh,1,'unknown response recovery commits exactly one story turn')
  await narrow.close();await wide.close();console.log(JSON.stringify({ok:true,liveModelCalled:false,productionWrites:false,checks:['restart-retains-old-session','explicit-switch','unknown-response-reload-recovery','one-commit-after-recovery','actor-isolation','locale-isolation','44px-rows','zh-390x844','en-320x568','no-overflow']}))
}finally{await browser?.close();await stopChild();await rm(databaseDirectory,{recursive:true,force:true})}


