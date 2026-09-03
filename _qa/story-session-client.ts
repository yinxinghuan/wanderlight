import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { createInitialSave } from '../src/story/engine/reducer'
import { StorySessionClient, StorySessionRequestError, createStorySessionHttpTransport } from '../src/story/session/storySessionClient'
import { StorySessionJournal, type StorySessionJournalStore } from '../src/story/session/storySessionJournal'
import { createStorySessionLab } from '../server/storySessionLab'

class Store implements StorySessionJournalStore {
  raw: string | null = null
  failIn = Infinity
  read() { return this.raw }
  write(value: string) { this.failIn -= 1; if (this.failIn === 0) throw new Error('INJECTED_STORAGE_FAILURE'); this.raw = value }
}

const directory = await mkdtemp(join(tmpdir(), 'wanderlight-story-session-'))
const databasePath = join(directory, 'story.sqlite')
const options = {
  cartridge: wanderlight,
  databasePath,
  actorTokens: { 'token-a': 'owner-a', 'token-b': 'owner-b' },
  failBeforeCommit: ['rollback-action'],
  generator: { async send(): Promise<never> { throw new Error('INJECTED_MODEL_OUTAGE') } },
}
let service = createStorySessionLab(options)
try {
  let { baseUrl } = await service.listen()
  let enrollmentLoss = true, actionLoss = true, offline = false, turnRequests = 0
  const turnBodies: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    if (offline) throw new TypeError('INJECTED_OFFLINE')
    const path = new URL(String(input)).pathname
    const enrolling = init?.method === 'POST' && path === '/api/story/sessions'
    const turning = init?.method === 'POST' && path.endsWith('/turns')
    if (turning) { turnRequests++; turnBodies.push(String(init?.body)) }
    const response = await fetch(input, init)
    if (enrolling && enrollmentLoss) { enrollmentLoss = false; await response.text(); throw new TypeError('INJECTED_ENROLLMENT_RESPONSE_LOSS') }
    if (turning && actionLoss) { actionLoss = false; offline = true; await response.text(); throw new TypeError('INJECTED_ACTION_RESPONSE_LOSS') }
    return response
  }
  const client = (token = 'token-a') => new StorySessionClient(createStorySessionHttpTransport({ apiBase: baseUrl, fetcher, headers: () => ({ Authorization: `Bearer ${token}` }) }))
  const initial = createInitialSave(wanderlight)
  const original = JSON.stringify(initial)
  const store = new Store(); const scope = 'wanderlight:deployment:owner-a:zh'
  await assert.rejects(new StorySessionJournal(client(), store, scope).open(initial), /INJECTED_ENROLLMENT_RESPONSE_LOSS/)
  assert.deepEqual(JSON.parse(store.raw!).enrollment.initialSave, JSON.parse(original))
  let journal = new StorySessionJournal(client(), store, scope)
  let head = await journal.open({ ...initial, scene: 999 })
  assert.equal(head.snapshot.scene, 0)
  assert.equal(JSON.stringify(initial), original)
  const action = head.snapshot.choices[0]!.label
  assert.deepEqual(client().prepare(head, action, 'stable-choice').input, { type: 'choice', definition_id: head.snapshot.choices[0]!.id })
  await assert.rejects(journal.act(action, head), /INJECTED_OFFLINE/)
  assert.equal(service.committedCount(), 1)
  assert.ok(JSON.parse(store.raw!).pending)
  await assert.rejects(journal.act(action, head), /PENDING_ACTION_REQUIRES_RECOVERY/)
  offline = false
  journal = new StorySessionJournal(client(), store, scope)
  head = await journal.open()
  assert.equal(head.version, 1)
  assert.equal(head.events.length, 1)
  assert.equal(service.committedCount(), 1)
  assert.equal(turnRequests, 1)
  const turnPath = `/api/story/sessions/${encodeURIComponent(head.session_id)}/turns`
  for (let replay = 0; replay < 3; replay++) {
    const response = await fetch(`${baseUrl}${turnPath}`, { method: 'POST', headers: { Authorization: 'Bearer token-a', 'Content-Type': 'application/json' }, body: turnBodies[0] })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).version, head.version)
  }
  assert.equal(service.committedCount(), 1, 'three exact replays do not add commits')
  const conflicting = JSON.parse(turnBodies[0]!)
  conflicting.input = { type: 'free-input', text: 'different payload' }
  const conflictResponse = await fetch(`${baseUrl}${turnPath}`, { method: 'POST', headers: { Authorization: 'Bearer token-a', 'Content-Type': 'application/json' }, body: JSON.stringify(conflicting) })
  assert.equal(conflictResponse.status, 409)
  assert.equal((await conflictResponse.json()).code, 'ACTION_ID_CONFLICT')
  const stale = { ...conflicting, action_id: 'stale-new-action', expected_version: 0, input: { type: 'choice', definition_id: head.snapshot.choices[0]!.id } }
  const staleResponse = await fetch(`${baseUrl}${turnPath}`, { method: 'POST', headers: { Authorization: 'Bearer token-a', 'Content-Type': 'application/json' }, body: JSON.stringify(stale) })
  assert.equal(staleResponse.status, 409)
  assert.equal((await staleResponse.json()).code, 'VERSION_CONFLICT')
  assert.equal(service.committedCount(), 1)
  await assert.rejects(client('token-b').read(head.session_id), (error: unknown) => error instanceof StorySessionRequestError && error.code === 'SESSION_NOT_FOUND')
  const callsBeforeStorageFailure = turnRequests
  store.failIn = 1
  await assert.rejects(journal.act(head.snapshot.choices[0]!.label, head), /INJECTED_STORAGE_FAILURE/)
  assert.equal(turnRequests, callsBeforeStorageFailure)
  store.failIn = Infinity
  const foreign = await client('token-b').enroll(createInitialSave(wanderlight), 'owner-b-enrollment')
  const beforeOutage = await client('token-b').read(foreign.session_id)
  await assert.rejects(client('token-b').submit(client('token-b').prepare(beforeOutage, '做一个不存在的自由行动', 'model-outage')), { code: 'MODEL_UNAVAILABLE' })
  assert.deepEqual(await client('token-b').read(foreign.session_id), beforeOutage)
  const rollbackSession = await client().enroll(createInitialSave(wanderlight), 'rollback-enrollment')
  const rollbackPending = client().prepare(rollbackSession, rollbackSession.snapshot.choices[0]!.label, 'rollback-action')
  await assert.rejects(client().submit(rollbackPending), { code: 'INTERNAL_ERROR' })
  assert.deepEqual(await client().read(rollbackSession.session_id), rollbackSession)
  assert.equal(service.committedCount(), 1, 'transaction fault rolls back snapshot, cache, event and audit')
  const rollbackRecovered = await client().submit(rollbackPending)
  assert.equal(rollbackRecovered.version, rollbackSession.version + 1)
  assert.equal(service.committedCount(), 2)
  await service.close()
  service = createStorySessionLab(options); ({ baseUrl } = await service.listen())
  const reopened = await client().read(head.session_id)
  assert.equal(reopened.version, head.version)
  assert.equal(reopened.events[0]?.action_id, head.events[0]?.action_id)
  assert.equal(service.committedCount(), 2)
  console.log(JSON.stringify({ ok: true, liveModelCalled: false, productionWrites: false, checks: [
    'old-save-enrollment-envelope-survives-response-loss', 'enrollment-is-nondestructive',
    'displayed-choice-uses-stable-definition-id', 'pending-is-persisted-before-network',
    'unknown-turn-outcome-reconciles-once', 'owner-isolation', 'storage-failure-zero-request',
    'three-replays-one-commit', 'action-id-payload-conflict', 'stale-version-zero-write',
    'model-outage-zero-write', 'transaction-failure-rollback-and-retry', 'disk-reopen-restores-head-and-event',
  ] }, null, 2))
} finally {
  await service.close().catch(() => {})
  await rm(directory, { recursive: true, force: true })
}


