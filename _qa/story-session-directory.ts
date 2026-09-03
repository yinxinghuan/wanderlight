import assert from 'node:assert/strict'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { createInitialSave } from '../src/story/engine/reducer'
import { StorySessionClient, StorySessionRequestError, createStorySessionHttpTransport } from '../src/story/session/storySessionClient'
import { StorySessionJournal, type StorySessionJournalStore } from '../src/story/session/storySessionJournal'
import { createStorySessionLab } from '../server/storySessionLab'

class Store implements StorySessionJournalStore {
  raw: string | null = null
  read() { return this.raw }
  write(value: string) { this.raw = value }
}

let now = 1_800_000_000_000
const service = createStorySessionLab({
  cartridge: wanderlight,
  actorTokens: { 'token-a': 'owner-a', 'token-b': 'owner-b' },
  sessionNow: () => now++,
  generator: { async send() { return { content: '你们把月线地图、风向和旧路标摊在一起，萤火航线指向林间驿站。\n[state: value="确认萤火航线与林间路标"]\n[choices: "请媛夕标出旧路"|"沿萤火航线前进"]' } } },
})

try {
  const { baseUrl } = await service.listen()
  const client = (token: string) => new StorySessionClient(createStorySessionHttpTransport({ apiBase: baseUrl, headers: () => ({ Authorization: `Bearer ${token}` }) }))
  const a = client('token-a'); const b = client('token-b')
  const privateSave = createInitialSave(wanderlight); privateSave.objective = 'PRIVATE_OWNER_A_SENTINEL'
  const first = await a.enroll(privateSave, 'owner-a-first')
  const second = await a.enroll(createInitialSave(wanderlight), 'owner-a-second')
  const foreign = await b.enroll(createInitialSave(wanderlight), 'owner-b-only')

  let directory = await a.list()
  assert.deepEqual(directory.sessions.map(entry => entry.session_id), [second.session_id, first.session_id])
  assert.equal(JSON.stringify(directory).includes('PRIVATE_OWNER_A_SENTINEL'), false)
  assert.equal(Object.hasOwn(directory.sessions[0]!, 'snapshot'), false)
  assert.equal(Object.hasOwn(directory.sessions[0]!, 'events'), false)
  assert.equal(directory.sessions.some(entry => entry.session_id === foreign.session_id), false)
  assert.deepEqual((await b.list()).sessions.map(entry => entry.session_id), [foreign.session_id])
  await assert.rejects(a.read(foreign.session_id), (error: unknown) => error instanceof StorySessionRequestError && error.code === 'SESSION_NOT_FOUND')
  await assert.rejects(a.list(0), /INVALID_SESSION_LIMIT/)

  const progressed = await a.submit(a.prepare(first, first.snapshot.choices[0]!.label, 'promote-first'))
  directory = await a.list(1)
  assert.equal(directory.sessions[0]!.session_id, first.session_id)
  assert.equal(directory.sessions[0]!.version, progressed.version)

  const store = new Store(); const scope = 'deployment:owner-a:zh'; const journal = new StorySessionJournal(a, store, scope)
  const opened = await journal.open(createInitialSave(wanderlight))
  const switched = await journal.switchSession(first.session_id)
  assert.equal(switched.session_id, first.session_id)
  const continued = await journal.act(switched.snapshot.choices[0]!.label, switched)
  assert.equal(continued.version, switched.version + 1)
  assert.notEqual(opened.session_id, first.session_id)
  const restarted = await journal.restart(createInitialSave(wanderlight))
  assert.notEqual(restarted.session_id, first.session_id)
  assert.equal((await journal.listSessions()).sessions.some(entry => entry.session_id === first.session_id), true)

  const pendingStore = new Store()
  pendingStore.raw = JSON.stringify({ schema: 1, scope, head: continued, pending: a.prepare(continued, continued.snapshot.choices[0]!.label, 'pending-switch') })
  await assert.rejects(new StorySessionJournal(a, pendingStore, scope).switchSession(second.session_id), /PENDING_ACTION_REQUIRES_RECOVERY/)
  const enrollmentStore = new Store()
  enrollmentStore.raw = JSON.stringify({ schema: 1, scope, enrollment: { id: 'new-session', initialSave: createInitialSave(wanderlight) } })
  await assert.rejects(new StorySessionJournal(a, enrollmentStore, scope).switchSession(second.session_id), /ENROLLMENT_REQUIRES_RECOVERY/)
  await assert.rejects(journal.switchSession(foreign.session_id), (error: unknown) => error instanceof StorySessionRequestError && error.code === 'SESSION_NOT_FOUND')
  assert.equal(JSON.parse(store.raw!).head.session_id, restarted.session_id)

  console.log(JSON.stringify({ ok: true, browserMounted: false, checks: ['owner-only-minimal-directory','authoritative-recency','bounded-query','restart-retains-old-session','explicit-switch','pending-enrollment-switch-gates','cross-owner-fail-closed'] }, null, 2))
} finally { await service.close() }


