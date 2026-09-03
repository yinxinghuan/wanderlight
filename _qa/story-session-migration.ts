import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { wanderlight } from '../src/story/cartridges/wanderlight'
import { createInitialSave } from '../src/story/engine/reducer'
import { createStorySessionLab, WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID } from '../server/storySessionLab'
import { StorySessionClient, createStorySessionHttpTransport } from '../src/story/session/storySessionClient'

const directory = await mkdtemp(join(tmpdir(), 'wanderlight-migration-'))
const databasePath = join(directory, 'migration.sqlite')
const headers = (token = 'token-a') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })
const clientFor = (baseUrl: string, token = 'token-a') => new StorySessionClient(createStorySessionHttpTransport({ apiBase: baseUrl, headers: () => ({ Authorization: `Bearer ${token}` }) }))
const body = (version: number, ruleset = 1, id = WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID) => JSON.stringify({ migration_id: id, expected_version: version, ruleset_version: ruleset })
const readHead = (sessionId: string) => { const db = new DatabaseSync(databasePath, { readOnly: true }); try { return (db.prepare('SELECT head_json FROM sessions WHERE session_id=?').get(sessionId) as {head_json:string}).head_json } finally { db.close() } }
const auditCount = () => { const db = new DatabaseSync(databasePath, { readOnly: true }); try { return Number((db.prepare('SELECT COUNT(*) n FROM migration_audit').get() as {n:number}).n) } finally { db.close() } }

try {
  const seed = createStorySessionLab({ cartridge: wanderlight, databasePath, actorTokens: { 'token-a': 'owner-a', 'token-b': 'owner-b' }, generator: { async send(): Promise<never> { throw new Error('unused') } } })
  const seedUrl = (await seed.listen()).baseUrl; const enrolled = await clientFor(seedUrl).enroll(createInitialSave(wanderlight), 'migration-seed'); await seed.close()
  const db = new DatabaseSync(databasePath)
  const stored = JSON.parse(readHead(enrolled.session_id)); stored.snapshot.version = 8; stored.snapshot.decisionContext = 'PRIVATE COPIED CONTEXT'; delete stored.snapshot.sceneLocation
  db.prepare('UPDATE sessions SET head_json=? WHERE session_id=?').run(JSON.stringify(stored), enrolled.session_id); db.close()

  let waiting = 0; let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve })
  const make = () => createStorySessionLab({ cartridge: wanderlight, databasePath, actorTokens: { 'token-a': 'owner-a', 'token-b': 'owner-b' }, beforeMigrationCommit: async () => { waiting += 1; if (waiting === 2) release(); await barrier }, generator: { async send() { return { content: '月线地图与旧路标被重新核对。\n[choices: "保存月线记录"|"询问媛夕"]' } } } })
  const one = make(); const two = make(); const oneUrl = (await one.listen()).baseUrl; const twoUrl = (await two.listen()).baseUrl
  const c1 = clientFor(oneUrl); const c2 = clientFor(twoUrl)
  const before = readHead(enrolled.session_id)
  const rawGet = await fetch(`${oneUrl}/api/story/sessions/${enrolled.session_id}`, { headers: headers() })
  assert.equal(rawGet.status, 200); assert.equal((await rawGet.json()).snapshot.version, 8); assert.equal(readHead(enrolled.session_id), before)
  for (const [token, payload, status, code] of [
    ['token-b', body(0), 404, 'SESSION_NOT_FOUND'], ['token-a', body(0, 1, 'unknown'), 400, 'INVALID_MIGRATION'],
    ['token-a', body(7), 409, 'VERSION_CONFLICT'], ['token-a', body(0, 2), 409, 'RULESET_MISMATCH'],
  ] as const) { const response = await fetch(`${oneUrl}/api/story/sessions/${enrolled.session_id}/migrations`, { method: 'POST', headers: headers(token), body: payload }); assert.equal(response.status, status); assert.equal((await response.json()).code, code) }
  const extra = await fetch(`${oneUrl}/api/story/sessions/${enrolled.session_id}/migrations`, { method: 'POST', headers: headers(), body: JSON.stringify({ migration_id: WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID, expected_version: 0, ruleset_version: 1, snapshot: {} }) })
  assert.equal(extra.status, 400); assert.equal(auditCount(), 0); assert.equal(readHead(enrolled.session_id), before)

  const results = await Promise.all([c1.migrate(enrolled.session_id, WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID, 0), c2.migrate(enrolled.session_id, WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID, 0)])
  assert.deepEqual(results.map(result => result.replayed).sort(), [false, true])
  assert.equal(results[0].version, 1); assert.equal(results[0].cursor, 0); assert.equal(results[0].events.length, 0)
  assert.equal(results[0].snapshot.version, 10); assert.equal(results[0].snapshot.decisionContext, ''); assert.equal(results[0].snapshot.sceneLocation, results[0].snapshot.location)
  assert.equal(auditCount(), 1)
  const auditDb = new DatabaseSync(databasePath, { readOnly: true }); const auditText = JSON.stringify(auditDb.prepare('SELECT * FROM migration_audit').all()); auditDb.close(); assert.equal(auditText.includes('PRIVATE COPIED CONTEXT'), false)
  await one.close(); await two.close()

  const reopened = createStorySessionLab({ cartridge: wanderlight, databasePath, actorTokens: { 'token-a': 'owner-a' }, generator: { async send(): Promise<never> { throw new Error('unused') } } })
  const reopenedUrl = (await reopened.listen()).baseUrl; const replay = await clientFor(reopenedUrl).migrate(enrolled.session_id, WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID, 0)
  assert.equal(replay.replayed, true); assert.equal(replay.version, 1); await reopened.close()

  const rollbackPath = join(directory, 'rollback.sqlite')
  const rollback = createStorySessionLab({ cartridge: wanderlight, databasePath: rollbackPath, actorTokens: { rollback: 'owner' }, failMigrationBeforeCommit: [WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID], generator: { async send(): Promise<never> { throw new Error('unused') } } })
  const rollbackUrl = (await rollback.listen()).baseUrl; const rollbackClient = clientFor(rollbackUrl, 'rollback'); const rollbackSession = await rollbackClient.enroll(createInitialSave(wanderlight), 'rollback')
  await assert.rejects(rollbackClient.migrate(rollbackSession.session_id, WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID, 0), { code: 'INTERNAL_ERROR' })
  assert.equal((await rollbackClient.read(rollbackSession.session_id)).version, 0)
  assert.equal((await rollbackClient.migrate(rollbackSession.session_id, WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID, 0)).version, 1)
  await rollback.close()

  console.log(JSON.stringify({ ok: true, checks: ['get-read-only','rejected-zero-write','client-target-snapshot-rejected','two-authorities-one-migration','version-bump-without-story-event','normalized-v8-to-v10','hash-only-audit','restart-idempotency','transaction-rollback-retry'] }, null, 2))
} finally { await rm(directory, { recursive: true, force: true }) }


