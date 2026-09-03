import assert from 'node:assert/strict'
import { fork, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { createInitialSave } from '../src/story/engine/reducer'
import { createStorySessionLab } from '../server/storySessionLab'
import { StorySessionClient, createStorySessionHttpTransport, type StorySessionPendingAction } from '../src/story/session/storySessionClient'

const directory = await mkdtemp(join(tmpdir(), 'wanderlight-session-process-'))
const databasePath = join(directory, 'session.sqlite')
const processes = new Set<ChildProcess>()
type Message = { type: string; baseUrl?: string; actionId?: string }

async function start() {
  const child = fork(fileURLToPath(new URL('./support/story-session-process.ts', import.meta.url)), [databasePath], {
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  processes.add(child)
  let stderr = ''; child.stderr?.on('data', bytes => { stderr += String(bytes) })
  const messages: Message[] = []; const listeners = new Set<() => void>()
  child.on('message', (message: Message) => { messages.push(message); for (const listener of listeners) listener() })
  child.on('exit', () => { for (const listener of listeners) listener() })
  const wait = (type: string, actionId?: string): Promise<Message> => new Promise((resolve, reject) => {
    const finish = (error?: Error, message?: Message) => { clearTimeout(timer); listeners.delete(check); error ? reject(error) : resolve(message!) }
    const check = () => { const index = messages.findIndex(message => message.type === type && (!actionId || message.actionId === actionId)); if (index >= 0) finish(undefined, messages.splice(index, 1)[0]); else if (child.exitCode !== null || child.signalCode !== null) finish(new Error(`service exited: ${stderr}`)) }
    const timer = setTimeout(() => finish(new Error(`timeout waiting for ${type}: ${stderr}`)), 10_000)
    listeners.add(check); check()
  })
  const baseUrl = (await wait('ready')).baseUrl!
  const client = (actor = 'a') => new StorySessionClient(createStorySessionHttpTransport({ apiBase: baseUrl, headers: () => ({ Authorization: `Bearer qa-process-${actor}` }) }))
  const post = (pending: StorySessionPendingAction) => fetch(`${baseUrl}/api/story/sessions/${pending.session_id}/turns`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer qa-process-a' }, body: JSON.stringify(pending),
  })
  return { child, wait, client, post, release: (actionId: string) => child.send({ type: 'release', actionId }) }
}

async function stop(child: ChildProcess, crash = false) {
  if (child.exitCode !== null || child.signalCode !== null) { processes.delete(child); return }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('service close timed out')) }, 5_000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
    crash ? child.kill('SIGKILL') : child.send({ type: 'close' })
  })
  processes.delete(child)
}

function counts() {
  const db = new DatabaseSync(databasePath, { readOnly: true })
  try { return { commits: Number((db.prepare('SELECT COUNT(*) AS n FROM audit').get() as { n: number }).n), sessions: Number((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n) } }
  finally { db.close() }
}

try {
  const first = await start(); const second = await start(); const initial = createInitialSave(wanderlight); const opening = initial.choices[0]!.label
  const [enrolled, duplicate] = await Promise.all([first.client().enroll(initial, 'shared-enrollment'), second.client().enroll(initial, 'shared-enrollment')])
  assert.deepEqual(duplicate, enrolled); assert.equal(counts().sessions, 1)
  const foreign = await second.client('b').enroll(initial, 'shared-enrollment')
  assert.notEqual(foreign.session_id, enrolled.session_id); await assert.rejects(second.client('b').read(enrolled.session_id), { code: 'SESSION_NOT_FOUND' })
  await assert.rejects(first.client().enroll({ ...initial, objective: 'changed' }, 'shared-enrollment'), { code: 'ENROLLMENT_ID_CONFLICT' })

  const raceA = first.client().prepare(enrolled, opening, 'race-a'); const raceB = second.client().prepare(enrolled, opening, 'race-b')
  const raceResponses = [first.post(raceA), second.post(raceB)]
  await Promise.all([first.wait('prepared', raceA.action_id), second.wait('prepared', raceB.action_id)]); first.release(raceA.action_id); second.release(raceB.action_id)
  const raced = await Promise.all(raceResponses); assert.deepEqual(raced.map(response => response.status).sort(), [200, 409]); assert.equal(counts().commits, 1)
  const winner = await first.client().read(enrolled.session_id); assert.equal(winner.version, 1); assert.equal(winner.cursor, 1)

  const sameSession = await first.client().enroll(initial, 'same-enrollment'); const same = first.client().prepare(sameSession, opening, 'race-same')
  const sameResponses = [first.post(same), second.post(same)]
  await Promise.all([first.wait('prepared', same.action_id), second.wait('prepared', same.action_id)]); first.release(same.action_id); second.release(same.action_id)
  const sameResults = await Promise.all(sameResponses); assert.deepEqual(sameResults.map(response => response.status), [200, 200])
  const samePayloads = await Promise.all(sameResults.map(response => response.json() as Promise<{ replayed: boolean }>))
  assert.deepEqual(samePayloads.map(payload => payload.replayed).sort(), [false, true]); assert.equal(counts().commits, 2)

  const rollbackSession = await first.client().enroll(initial, 'rollback-enrollment'); const rollback = first.client().prepare(rollbackSession, opening, 'rollback-action')
  assert.equal((await first.post(rollback)).status, 500); assert.deepEqual(await first.client().read(rollbackSession.session_id), rollbackSession); assert.equal(counts().commits, 2)
  const recovered = await first.client().submit(rollback); assert.equal(recovered.version, 1); assert.equal(counts().commits, 3)

  const lostSession = await first.client().enroll(initial, 'lost-enrollment'); const lost = first.client().prepare(lostSession, opening, 'lost-before-restart')
  await assert.rejects(first.post(lost)); const durable = await second.client().read(lostSession.session_id)
  assert.equal(durable.version, 1); assert.equal(durable.events[0]?.action_id, lost.action_id); assert.equal(counts().commits, 4)
  await stop(first.child, true); await stop(second.child)

  const reopened = await start()
  assert.deepEqual(await reopened.client().read(lostSession.session_id), durable)
  assert.deepEqual(await reopened.client().enroll(initial, 'lost-enrollment'), lostSession)
  assert.equal((await reopened.client().submit(lost)).version, durable.version); assert.equal(counts().commits, 4)
  await assert.rejects(reopened.client('b').read(lostSession.session_id), { code: 'SESSION_NOT_FOUND' })
  const since = await reopened.client().read(lostSession.session_id, durable.cursor - 1); assert.deepEqual(since.events.map(event => event.action_id), [lost.action_id])

  const contractOptions = { cartridge: wanderlight, databasePath, actorTokens: {}, generator: { async send(): Promise<never> { throw new Error('unused') } } }
  assert.throws(() => createStorySessionLab({ ...contractOptions, rulesetVersion: 2 }), /DATABASE_CONTRACT_MISMATCH/)
  assert.throws(() => createStorySessionLab({ ...contractOptions, cartridge: { ...wanderlight, id: 'different-game' } }), /DATABASE_CONTRACT_MISMATCH/)
  console.log(JSON.stringify({ ok: true, liveModelCalled: false, productionWrites: false, checks: [
    'two-process-owner-scoped-idempotent-enrollment', 'different-action-same-version-one-winner',
    'same-action-two-processes-one-commit', 'atomic-rollback-and-same-request-retry',
    'lost-response-and-process-kill-recover-from-disk', 'enrollment-and-action-cache-survive-restart',
    'cursor-and-owner-isolation-survive-restart', 'database-game-and-ruleset-contract',
  ], ...counts() }, null, 2))
} finally {
  await Promise.all([...processes].map(child => stop(child, true)))
  await rm(directory, { recursive: true, force: true })
}


