import { createHash, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import type { StoryCartridge, StorySave } from '../src/story/types'
import type { StorySessionHead } from '../src/story/session/storySessionClient'
import { executeStoryTurn, type StoryTurnGenerator } from '../src/story/engine/executeTurn'
import { normalizeSave } from '../src/story/useStoryEngine'

interface Event { seq: number; version: number; action_id: string; source: string }
interface Head { sessionId: string; owner: string; rulesetVersion: number; version: number; cursor: number; snapshot: StorySave; events: Event[]; cache: Record<string, { fingerprint: string; response: StorySessionHead }> }
interface MigrationAudit { request_fingerprint: string; before_snapshot_fingerprint: string; after_snapshot_fingerprint: string; version_after: number; snapshot_changed: number }
export const WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID = 'wanderlight-save-v10-repair-2026-09-04'
type JsonObject = Record<string, unknown>
class RequestError extends Error { constructor(readonly status: number, readonly code: string) { super(code) } }
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`; if (value && typeof value === 'object') { const object = value as JsonObject; return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}` }; return JSON.stringify(value) ?? 'null' }
function fingerprint(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex') }
function counter(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function stableId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) }
function send(response: ServerResponse, status: number, payload: unknown) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(payload)) }
async function readJson(request: IncomingMessage): Promise<JsonObject> { const chunks: Buffer[] = []; let size = 0; for await (const chunk of request) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length; if (size > 2_000_000) throw new RequestError(413, 'REQUEST_TOO_LARGE'); chunks.push(bytes) }; try { const parsed: unknown = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); return parsed as JsonObject } catch { throw new RequestError(400, 'INVALID_JSON') } }
function token(request: IncomingMessage) { const value = request.headers.authorization; return value?.startsWith('Bearer ') ? value.slice(7) : undefined }

/** Loopback-only SQLite authority lab. QA bearer tokens are never production identity. */
export function createStorySessionLab(options: {
  cartridge: StoryCartridge; generator: StoryTurnGenerator; actorTokens: Record<string, string>
  databasePath?: string; rulesetVersion?: number; failBeforeCommit?: string[]
  beforeCommit?: (actionId: string) => Promise<void>
  beforeMigrationCommit?: (migrationId: string) => Promise<void>; failMigrationBeforeCommit?: string[]; sessionNow?: () => number
  dropResponseAfterCommit?: string[]
}) {
  const rulesetVersion = options.rulesetVersion ?? 1
  const db = new DatabaseSync(options.databasePath ?? ':memory:')
  const actors = new Map(Object.entries(options.actorTokens)); const failBeforeCommit = new Set(options.failBeforeCommit ?? [])
  const dropAfterCommit = new Set(options.dropResponseAfterCommit ?? []); const dropped = new Set<string>(); const failMigrationBeforeCommit = new Set(options.failMigrationBeforeCommit ?? []); const sessionNow = options.sessionNow ?? Date.now
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS metadata(id INTEGER PRIMARY KEY CHECK(id=1),contract TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(session_id TEXT PRIMARY KEY,owner TEXT NOT NULL,head_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS enrollments(owner TEXT NOT NULL,enrollment_id TEXT NOT NULL,fingerprint TEXT NOT NULL,response_json TEXT NOT NULL,PRIMARY KEY(owner,enrollment_id));
    CREATE TABLE IF NOT EXISTS audit(session_id TEXT NOT NULL,action_id TEXT NOT NULL,PRIMARY KEY(session_id,action_id));
    CREATE TABLE IF NOT EXISTS session_directory(session_id TEXT PRIMARY KEY,owner TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS session_directory_owner_updated ON session_directory(owner,updated_at DESC,created_at DESC);
    CREATE TABLE IF NOT EXISTS migration_audit(session_id TEXT NOT NULL,migration_id TEXT NOT NULL,request_fingerprint TEXT NOT NULL,before_snapshot_fingerprint TEXT NOT NULL,after_snapshot_fingerprint TEXT NOT NULL,version_after INTEGER NOT NULL,snapshot_changed INTEGER NOT NULL,PRIMARY KEY(session_id,migration_id));
    INSERT OR IGNORE INTO session_directory(session_id,owner,created_at,updated_at) SELECT session_id,owner,0,0 FROM sessions;`)
  const contract = canonical({ schema: 1, cartridge: options.cartridge.id, locale: options.cartridge.locale, rulesetVersion })
  db.prepare('INSERT OR IGNORE INTO metadata(id,contract) VALUES(1,?)').run(contract)
  if ((db.prepare('SELECT contract FROM metadata WHERE id=1').get() as { contract: string }).contract !== contract) { db.close(); throw new Error('DATABASE_CONTRACT_MISMATCH') }
  const readSession = db.prepare('SELECT owner,head_json FROM sessions WHERE session_id=?')
  const insertSession = db.prepare('INSERT INTO sessions(session_id,owner,head_json) VALUES(?,?,?)')
  const writeSession = db.prepare('UPDATE sessions SET head_json=? WHERE session_id=?')
  const readEnrollment = db.prepare('SELECT fingerprint,response_json FROM enrollments WHERE owner=? AND enrollment_id=?')
  const insertEnrollment = db.prepare('INSERT INTO enrollments(owner,enrollment_id,fingerprint,response_json) VALUES(?,?,?,?)')
  const insertAudit = db.prepare('INSERT INTO audit(session_id,action_id) VALUES(?,?)')
  const insertDirectory = db.prepare('INSERT INTO session_directory(session_id,owner,created_at,updated_at) VALUES(?,?,?,?)')
  const touchDirectory = db.prepare('UPDATE session_directory SET updated_at=? WHERE session_id=? AND owner=?')
  const listDirectory = db.prepare(`SELECT d.session_id,d.created_at,d.updated_at,s.head_json FROM session_directory d JOIN sessions s ON s.session_id=d.session_id WHERE d.owner=? ORDER BY d.updated_at DESC,d.created_at DESC,d.session_id ASC LIMIT ?`)
  const readMigration = db.prepare('SELECT request_fingerprint,before_snapshot_fingerprint,after_snapshot_fingerprint,version_after,snapshot_changed FROM migration_audit WHERE session_id=? AND migration_id=?')
  const insertMigration = db.prepare('INSERT INTO migration_audit(session_id,migration_id,request_fingerprint,before_snapshot_fingerprint,after_snapshot_fingerprint,version_after,snapshot_changed) VALUES(?,?,?,?,?,?,?)')
  const ownedHead = (sessionId: string, owner: string): Head | undefined => { const row = readSession.get(sessionId) as { owner: string; head_json: string } | undefined; return row?.owner === owner ? JSON.parse(row.head_json) as Head : undefined }
  const view = (head: Head, after = 0): StorySessionHead => ({ session_id: head.sessionId, ruleset_version: head.rulesetVersion, version: head.version, cursor: head.cursor, snapshot: head.snapshot, events: head.events.filter(event => event.seq > after) })
  const migrationResponse = (head: Head, migrationId: string, record: MigrationAudit, replayed: boolean) => ({ ...view(head), ok: true, migration_id: migrationId, migrated_from_version: record.version_after - 1, migrated_to_version: record.version_after, snapshot_changed: Boolean(record.snapshot_changed), replayed })
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (request.method === 'GET' && url.pathname === '/api/story/health') { send(response, 200, { ok: true, persistent: Boolean(options.databasePath), identity_mode: 'qa-token-only', production_writes: false }); return }
      const bearer = token(request); const owner = bearer ? actors.get(bearer) : undefined
      if (!owner) { send(response, 401, { code: 'AUTH_REQUIRED' }); return }
      if (request.method === 'GET' && url.pathname === '/api/story/sessions') {
        const raw = url.searchParams.get('limit'); const limit = raw === null ? 20 : Number(raw)
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new RequestError(400, 'INVALID_SESSION_LIMIT')
        const sessions = (listDirectory.all(owner, limit) as Array<{session_id:string;created_at:number;updated_at:number;head_json:string}>).map(row => { const head = JSON.parse(row.head_json) as Head; return { session_id: row.session_id, ruleset_version: head.rulesetVersion, version: head.version, cursor: head.cursor, locale: head.snapshot.locale, scene: head.snapshot.scene, created_at: row.created_at, updated_at: row.updated_at } })
        send(response, 200, { sessions }); return
      }
      if (request.method === 'POST' && url.pathname === '/api/story/sessions') {
        const body = await readJson(request); const imported = body.initial_save as StorySave | undefined
        if (!imported || imported.version !== 10 || imported.cartridgeId !== options.cartridge.id || imported.locale !== options.cartridge.locale || !counter(imported.scene) || !Array.isArray(imported.blocks) || !Array.isArray(imported.choices)) throw new RequestError(400, 'INVALID_SAVE')
        if (!stableId(body.enrollment_id) || body.initial_version !== imported.scene) throw new RequestError(400, 'INVALID_ENROLLMENT')
        const requestFingerprint = fingerprint({ initial_save: imported, initial_version: body.initial_version })
        db.exec('BEGIN IMMEDIATE')
        try {
          const cached = readEnrollment.get(owner, body.enrollment_id) as { fingerprint: string; response_json: string } | undefined
          if (cached) { db.exec('COMMIT'); if (cached.fingerprint !== requestFingerprint) throw new RequestError(409, 'ENROLLMENT_ID_CONFLICT'); send(response, 200, JSON.parse(cached.response_json)); return }
          const head: Head = { sessionId: randomUUID(), owner, rulesetVersion, version: imported.scene, cursor: 0, snapshot: structuredClone(imported), events: [], cache: {} }
          const created = view(head); insertSession.run(head.sessionId, owner, JSON.stringify(head)); const createdAt = sessionNow(); if (!counter(createdAt)) throw new RequestError(500, 'INVALID_SESSION_CLOCK'); insertDirectory.run(head.sessionId, owner, createdAt, createdAt); insertEnrollment.run(owner, body.enrollment_id, requestFingerprint, JSON.stringify(created)); db.exec('COMMIT'); send(response, 201, created)
        } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error }
        return
      }
      const migrationMatch = url.pathname.match(/^\/api\/story\/sessions\/([^/]+)\/migrations$/)
      if (migrationMatch) {
        if (request.method !== 'POST') { send(response, 405, { code: 'METHOD_NOT_ALLOWED' }); return }
        const sessionId = decodeURIComponent(migrationMatch[1]!); const current = ownedHead(sessionId, owner)
        if (!current) { send(response, 404, { code: 'SESSION_NOT_FOUND' }); return }
        const body = await readJson(request)
        if (Object.keys(body).some(key => !['migration_id','expected_version','ruleset_version'].includes(key)) || body.migration_id !== WANDERLIGHT_SAVE_REPAIR_MIGRATION_ID || !counter(body.expected_version) || !counter(body.ruleset_version)) throw new RequestError(400, 'INVALID_MIGRATION')
        const migrationId = body.migration_id; const requestFingerprint = fingerprint({ expected_version: body.expected_version, ruleset_version: body.ruleset_version })
        const cached = readMigration.get(sessionId, migrationId) as MigrationAudit | undefined
        if (cached) { send(response, cached.request_fingerprint === requestFingerprint ? 200 : 409, cached.request_fingerprint === requestFingerprint ? migrationResponse(current, migrationId, cached, true) : { code: 'MIGRATION_ID_CONFLICT' }); return }
        if (body.ruleset_version !== current.rulesetVersion) { send(response, 409, { code: 'RULESET_MISMATCH' }); return }
        if (body.expected_version !== current.version) { send(response, 409, { code: 'VERSION_CONFLICT' }); return }
        const beforeSnapshotFingerprint = fingerprint(current.snapshot); const migrated = normalizeSave(structuredClone(current.snapshot), options.cartridge)
        if (migrated.version !== 10 || migrated.cartridgeId !== options.cartridge.id || migrated.locale !== options.cartridge.locale || !Array.isArray(migrated.blocks) || !Array.isArray(migrated.choices) || !Array.isArray(migrated.inventory) || !Array.isArray(migrated.map) || !migrated.facts || !migrated.danger) throw new RequestError(409, 'MIGRATION_RESULT_INVALID')
        const afterSnapshotFingerprint = fingerprint(migrated); await options.beforeMigrationCommit?.(migrationId)
        db.exec('BEGIN IMMEDIATE')
        try {
          const locked = ownedHead(sessionId, owner)!; const raced = readMigration.get(sessionId, migrationId) as MigrationAudit | undefined
          if (raced) { db.exec('COMMIT'); send(response, raced.request_fingerprint === requestFingerprint ? 200 : 409, raced.request_fingerprint === requestFingerprint ? migrationResponse(locked, migrationId, raced, true) : { code: 'MIGRATION_ID_CONFLICT' }); return }
          if (locked.rulesetVersion !== body.ruleset_version) { db.exec('ROLLBACK'); send(response, 409, { code: 'RULESET_MISMATCH' }); return }
          if (locked.version !== current.version || fingerprint(locked.snapshot) !== beforeSnapshotFingerprint) { db.exec('ROLLBACK'); send(response, 409, { code: 'VERSION_CONFLICT' }); return }
          locked.snapshot = migrated; locked.version += 1
          const record: MigrationAudit = { request_fingerprint: requestFingerprint, before_snapshot_fingerprint: beforeSnapshotFingerprint, after_snapshot_fingerprint: afterSnapshotFingerprint, version_after: locked.version, snapshot_changed: Number(beforeSnapshotFingerprint !== afterSnapshotFingerprint) }
          writeSession.run(JSON.stringify(locked), sessionId); const migratedAt = sessionNow(); if (!counter(migratedAt)) throw new RequestError(500, 'INVALID_SESSION_CLOCK'); touchDirectory.run(migratedAt, sessionId, owner); insertMigration.run(sessionId, migrationId, record.request_fingerprint, record.before_snapshot_fingerprint, record.after_snapshot_fingerprint, record.version_after, record.snapshot_changed)
          if (failMigrationBeforeCommit.delete(migrationId)) throw new Error('INJECTED_MIGRATION_FAILURE_BEFORE_COMMIT')
          db.exec('COMMIT'); send(response, 200, migrationResponse(locked, migrationId, record, false))
        } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error }
        return
      }
      const match = url.pathname.match(/^\/api\/story\/sessions\/([^/]+)(\/turns)?$/)
      if (!match) { send(response, 404, { code: 'NOT_FOUND' }); return }
      const sessionId = decodeURIComponent(match[1]!); const current = ownedHead(sessionId, owner)
      if (!current) { send(response, 404, { code: 'SESSION_NOT_FOUND' }); return }
      if (request.method === 'GET' && !match[2]) { send(response, 200, view(current, Math.max(0, Number(url.searchParams.get('after_cursor')) || 0))); return }
      if (request.method !== 'POST' || match[2] !== '/turns') { send(response, 405, { code: 'METHOD_NOT_ALLOWED' }); return }
      const body = await readJson(request); const input = body.input as { type?: string; definition_id?: string; text?: string } | undefined
      if (!stableId(body.action_id) || !counter(body.expected_version) || !counter(body.ruleset_version)) throw new RequestError(400, 'INVALID_ACTION')
      const requestFingerprint = fingerprint({ expected_version: body.expected_version, ruleset_version: body.ruleset_version, input })
      const cached = current.cache[body.action_id]
      if (cached) { send(response, cached.fingerprint === requestFingerprint ? 200 : 409, cached.fingerprint === requestFingerprint ? { ...cached.response, replayed: true } : { code: 'ACTION_ID_CONFLICT' }); return }
      if (body.ruleset_version !== current.rulesetVersion) { send(response, 409, { code: 'RULESET_MISMATCH' }); return }
      if (body.expected_version !== current.version) { send(response, 409, { code: 'VERSION_CONFLICT' }); return }
      const action = input?.type === 'choice' && typeof input.definition_id === 'string' ? current.snapshot.choices.find(choice => choice.id === input.definition_id)?.label ?? '' : input?.type === 'free-input' && typeof input.text === 'string' && input.text.length <= 2_000 ? input.text.trim() : ''
      if (!action) throw new RequestError(400, 'INVALID_ACTION')
      let executed
      try { executed = await executeStoryTurn({ save: current.snapshot, cartridge: options.cartridge, action, generator: options.generator }) } catch { send(response, 503, { code: 'MODEL_UNAVAILABLE' }); return }
      await options.beforeCommit?.(body.action_id)
      db.exec('BEGIN IMMEDIATE')
      try {
        const locked = ownedHead(sessionId, owner)!; const raced = locked.cache[body.action_id]
        if (raced) { db.exec('COMMIT'); send(response, raced.fingerprint === requestFingerprint ? 200 : 409, raced.fingerprint === requestFingerprint ? { ...raced.response, replayed: true } : { code: 'ACTION_ID_CONFLICT' }); return }
        if (locked.version !== current.version) { db.exec('ROLLBACK'); send(response, 409, { code: 'VERSION_CONFLICT' }); return }
        locked.version += 1; locked.cursor += 1; locked.snapshot = executed.save; locked.events.push({ seq: locked.cursor, version: locked.version, action_id: body.action_id, source: executed.source })
        const committed = view(locked); locked.cache[body.action_id] = { fingerprint: requestFingerprint, response: committed }
        writeSession.run(JSON.stringify(locked), sessionId); const committedAt = sessionNow(); if (!counter(committedAt)) throw new RequestError(500, 'INVALID_SESSION_CLOCK'); touchDirectory.run(committedAt, sessionId, owner); insertAudit.run(sessionId, body.action_id); if (failBeforeCommit.delete(body.action_id)) throw new Error('INJECTED_FAILURE_BEFORE_COMMIT')
        db.exec('COMMIT')
        if (dropAfterCommit.has(body.action_id) && !dropped.has(body.action_id)) { dropped.add(body.action_id); response.destroy(new Error('INJECTED_RESPONSE_LOSS_AFTER_COMMIT')); return }
        send(response, 200, { ...committed, replayed: false })
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error }
    } catch (error) { if (error instanceof RequestError) { send(response, error.status, { code: error.code }); return }; send(response, 500, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) }) }
  })
  return {
    async listen(port = 0) { await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) }); const address = server.address(); if (!address || typeof address === 'string') throw new Error('LAB_BIND_FAILED'); return { baseUrl: `http://127.0.0.1:${address.port}` } },
    async close() { try { if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) } finally { db.close() } },
    committedCount() { return Number((db.prepare('SELECT COUNT(*) AS n FROM audit').get() as { n: number }).n) },
  }
}


