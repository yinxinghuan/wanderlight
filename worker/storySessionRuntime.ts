type Locale = 'zh' | 'en'

interface StorySave {
  version: number
  cartridgeId: string
  locale: Locale
  scene: number
  blocks: Array<{ id: string; kind: string; data?: Record<string, unknown> }>
  choices: Array<{ id: string; label: string }>
  inventory: Array<{ id: string; imageStatus?: string; imageUrl?: string }>
  finale?: { status?: string; snapshot?: { id?: string }; [key: string]: unknown }
  [key: string]: unknown
}

interface StoryHead {
  sessionId: string
  owner: string
  rulesetVersion: number
  version: number
  cursor: number
  snapshot: StorySave
  events: Array<{ seq: number; version: number; action_id: string; source: string }>
}

interface RuntimeOptions {
  gameId: string
  resolveCartridge(locale: Locale): any
  normalizeSave(save: StorySave, cartridge: any): StorySave
  executeTurn(options: { save: StorySave; cartridge: any; action: string; locale: Locale; generator: any }): Promise<{ save: StorySave; source: string }>
  generator: any
  generateEnding?: (cartridge: any, save: StorySave) => Promise<{ ending: any; snapshot: any; usedFallback: boolean; errors: string[] }>
  buildEndingSnapshot?: (save: StorySave, cartridge: any) => { id: string }
  applyMutation?: (save: StorySave, mutation: unknown) => StorySave
}

const json = (value: unknown, status = 200) => Response.json(value, { status })
const error = (code: string, status = 400) => json({ code }, status)
const stableId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const safeInt = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const localeOf = (value: unknown): Locale => value === 'en' ? 'en' : 'zh'

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function createStorySessionRuntime(options: RuntimeOptions) {
  class StorySessionAuthority {
    private readonly sql: any
    constructor(private readonly ctx: any, private readonly env: any) {
      this.sql = ctx.storage.sql
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY, owner TEXT NOT NULL, ruleset_version INTEGER NOT NULL,
          version INTEGER NOT NULL, cursor INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_owner_updated ON sessions(owner, updated_at DESC);
        CREATE TABLE IF NOT EXISTS events (
          session_id TEXT NOT NULL, seq INTEGER NOT NULL, version INTEGER NOT NULL,
          action_id TEXT NOT NULL, source TEXT NOT NULL,
          PRIMARY KEY(session_id, seq), UNIQUE(session_id, action_id)
        );
        CREATE TABLE IF NOT EXISTS action_cache (
          owner TEXT NOT NULL, action_id TEXT NOT NULL, request_hash TEXT NOT NULL,
          response_json TEXT NOT NULL, PRIMARY KEY(owner, action_id)
        );
        CREATE TABLE IF NOT EXISTS enrollment_cache (
          owner TEXT NOT NULL, enrollment_id TEXT NOT NULL, request_hash TEXT NOT NULL,
          response_json TEXT NOT NULL, PRIMARY KEY(owner, enrollment_id)
        );
        CREATE TABLE IF NOT EXISTS ending_cache (
          owner TEXT NOT NULL, ending_id TEXT NOT NULL, request_hash TEXT NOT NULL,
          response_json TEXT NOT NULL, PRIMARY KEY(owner, ending_id)
        );
        CREATE TABLE IF NOT EXISTS media_overlay (
          session_id TEXT NOT NULL, entity_id TEXT NOT NULL, request_id TEXT NOT NULL,
          kind TEXT NOT NULL, url TEXT NOT NULL, created_at INTEGER NOT NULL,
          PRIMARY KEY(session_id, entity_id), UNIQUE(session_id, request_id)
        );
        CREATE TABLE IF NOT EXISTS mutation_cache (
          owner TEXT NOT NULL, mutation_id TEXT NOT NULL, request_hash TEXT NOT NULL,
          response_json TEXT NOT NULL, PRIMARY KEY(owner, mutation_id)
        );
      `)
    }

    private one(query: string, ...values: unknown[]) {
      return [...this.sql.exec(query, ...values)][0] as Record<string, any> | undefined
    }

    private session(sessionId: string, owner: string): StoryHead | undefined {
      const row = this.one('SELECT * FROM sessions WHERE session_id = ? AND owner = ?', sessionId, owner)
      if (!row) return undefined
      return {
        sessionId: row.session_id, owner: row.owner, rulesetVersion: Number(row.ruleset_version),
        version: Number(row.version), cursor: Number(row.cursor), snapshot: JSON.parse(row.snapshot_json),
        events: [...this.sql.exec('SELECT seq, version, action_id, source FROM events WHERE session_id = ? ORDER BY seq', sessionId)] as StoryHead['events'],
      }
    }

    private projectMedia(sessionId: string, snapshot: StorySave): StorySave {
      const rows = [...this.sql.exec('SELECT entity_id, kind, url FROM media_overlay WHERE session_id = ?', sessionId)] as Array<{entity_id:string;kind:string;url:string}>
      if (!rows.length) return snapshot
      const overlays = new Map(rows.map(row => [row.entity_id, row]))
      return {
        ...snapshot,
        blocks: snapshot.blocks.map(block => {
          const overlay = overlays.get(block.id)
          return overlay?.kind === 'block' ? { ...block, data: { ...block.data, status: 'ready', url: overlay.url } } : block
        }),
        inventory: snapshot.inventory.map(item => {
          const overlay = overlays.get(item.id)
          return overlay?.kind === 'inventory' ? { ...item, imageStatus: 'ready', imageUrl: overlay.url } : item
        }),
      }
    }

    private view(head: StoryHead, after = 0) {
      return {
        session_id: head.sessionId, ruleset_version: head.rulesetVersion, version: head.version,
        cursor: head.cursor, snapshot: this.projectMedia(head.sessionId, head.snapshot),
        events: head.events.filter(event => event.seq > after),
      }
    }

    private write(head: StoryHead, now: number) {
      this.sql.exec(
        'UPDATE sessions SET version = ?, cursor = ?, snapshot_json = ?, updated_at = ? WHERE session_id = ? AND owner = ?',
        head.version, head.cursor, JSON.stringify(head.snapshot), now, head.sessionId, head.owner,
      )
    }

    private validSave(value: unknown): value is StorySave {
      const save = value as StorySave
      return Boolean(save && save.version >= 8 && save.cartridgeId === options.gameId
        && (save.locale === 'zh' || save.locale === 'en') && safeInt(save.scene)
        && Array.isArray(save.blocks) && Array.isArray(save.choices) && Array.isArray(save.inventory))
    }

    async fetch(request: Request) {
      try {
        const owner = request.headers.get('X-Story-Owner') ?? ''
        if (!/^[a-f0-9]{64}$/.test(owner)) return error('AUTH_REQUIRED', 401)
        const url = new URL(request.url)
        const now = Date.now()

        if (request.method === 'GET' && url.pathname === '/api/story/sessions') {
          const limit = Number(url.searchParams.get('limit') ?? 20)
          if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return error('INVALID_SESSION_LIMIT')
          const rows = [...this.sql.exec(
            'SELECT session_id, ruleset_version, version, cursor, snapshot_json, created_at, updated_at FROM sessions WHERE owner = ? ORDER BY updated_at DESC, created_at DESC LIMIT ?',
            owner, limit,
          )] as Array<Record<string, any>>
          return json({ sessions: rows.map(row => {
            const snapshot = JSON.parse(row.snapshot_json) as StorySave
            return { session_id: row.session_id, ruleset_version: Number(row.ruleset_version), version: Number(row.version),
              cursor: Number(row.cursor), locale: snapshot.locale, scene: snapshot.scene,
              created_at: Number(row.created_at), updated_at: Number(row.updated_at) }
          }) })
        }

        if (request.method === 'POST' && url.pathname === '/api/story/sessions') {
          const body = await request.json() as Record<string, any>
          if (!stableId(body.enrollment_id) || !this.validSave(body.initial_save) || body.initial_version !== body.initial_save.scene) return error('INVALID_ENROLLMENT')
          const requestHash = await digest({ initial_save: body.initial_save, initial_version: body.initial_version })
          const cached = this.one('SELECT request_hash, response_json FROM enrollment_cache WHERE owner = ? AND enrollment_id = ?', owner, body.enrollment_id)
          if (cached) return cached.request_hash === requestHash ? json(JSON.parse(cached.response_json)) : error('ENROLLMENT_ID_CONFLICT', 409)
          const cartridge = options.resolveCartridge(localeOf(body.initial_save.locale))
          const snapshot = options.normalizeSave(structuredClone(body.initial_save), cartridge)
          if (!this.validSave(snapshot)) return error('INVALID_SAVE')
          const sessionId = crypto.randomUUID(); const version = snapshot.scene
          const head: StoryHead = { sessionId, owner, rulesetVersion: 1, version, cursor: 0, snapshot, events: [] }
          const response = this.view(head)
          this.ctx.storage.transactionSync(() => {
            const raced = this.one('SELECT request_hash FROM enrollment_cache WHERE owner = ? AND enrollment_id = ?', owner, body.enrollment_id)
            if (raced) throw new Error(raced.request_hash === requestHash ? 'ENROLLMENT_REPLAY' : 'ENROLLMENT_ID_CONFLICT')
            this.sql.exec('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)', sessionId, owner, 1, version, 0, JSON.stringify(snapshot), now, now)
            this.sql.exec('INSERT INTO enrollment_cache VALUES (?, ?, ?, ?)', owner, body.enrollment_id, requestHash, JSON.stringify(response))
          })
          return json(response, 201)
        }

        const media = url.pathname.match(/^\/api\/story\/sessions\/([^/]+)\/media\/([^/]+)$/)
        if (media && request.method === 'POST') {
          const sessionId = decodeURIComponent(media[1]); const entityId = decodeURIComponent(media[2])
          const head = this.session(sessionId, owner); if (!head) return error('SESSION_NOT_FOUND', 404)
          const body = await request.json() as Record<string, any>
          if (!stableId(body.request_id) || !['block', 'inventory'].includes(body.kind)
            || typeof body.url !== 'string' || !/^https:\/\/cdn\.aiwaves\.tech\//.test(body.url)) return error('INVALID_MEDIA')
          const exists = body.kind === 'block' ? head.snapshot.blocks.some(block => block.id === entityId)
            : head.snapshot.inventory.some(item => item.id === entityId)
          if (!exists) return error('MEDIA_ENTITY_NOT_FOUND', 404)
          const cached = this.one('SELECT entity_id, kind, url FROM media_overlay WHERE session_id = ? AND request_id = ?', sessionId, body.request_id)
          if (cached && (cached.entity_id !== entityId || cached.kind !== body.kind || cached.url !== body.url)) return error('MEDIA_REQUEST_CONFLICT', 409)
          this.sql.exec('INSERT OR IGNORE INTO media_overlay VALUES (?, ?, ?, ?, ?, ?)', sessionId, entityId, body.request_id, body.kind, body.url, now)
          return json(this.view(this.session(sessionId, owner)!))
        }

        const ending = url.pathname.match(/^\/api\/story\/sessions\/([^/]+)\/ending$/)
        if (ending && request.method === 'POST') {
          const sessionId = decodeURIComponent(ending[1]); const current = this.session(sessionId, owner)
          if (!current) return error('SESSION_NOT_FOUND', 404)
          if (!options.generateEnding || !options.buildEndingSnapshot) return error('ENDING_UNAVAILABLE', 503)
          const body = await request.json() as Record<string, any>
          if (!stableId(body.ending_id) || !stableId(body.snapshot_id) || !safeInt(body.expected_version) || body.ruleset_version !== current.rulesetVersion) return error('INVALID_ENDING')
          const requestHash = await digest({ expected_version: body.expected_version, ruleset_version: body.ruleset_version, snapshot_id: body.snapshot_id })
          const cached = this.one('SELECT request_hash, response_json FROM ending_cache WHERE owner = ? AND ending_id = ?', owner, body.ending_id)
          if (cached) return cached.request_hash === requestHash ? json(JSON.parse(cached.response_json)) : error('ENDING_ID_CONFLICT', 409)
          if (body.expected_version !== current.version) return error('VERSION_CONFLICT', 409)
          const cartridge = options.resolveCartridge(current.snapshot.locale)
          const frozen = options.buildEndingSnapshot(current.snapshot, cartridge)
          if (frozen.id !== body.snapshot_id) return error('ENDING_SNAPSHOT_MISMATCH', 409)
          const generated = await options.generateEnding(cartridge, structuredClone(current.snapshot))
          if (generated.snapshot?.id !== frozen.id || generated.ending?.snapshotId !== frozen.id) return error('ENDING_RESULT_MISMATCH', 409)
          let response: any
          this.ctx.storage.transactionSync(() => {
            const locked = this.session(sessionId, owner); if (!locked || locked.version !== current.version) throw new Error('VERSION_CONFLICT')
            locked.version += 1
            locked.snapshot = { ...locked.snapshot, finale: { status: 'complete', reason: locked.snapshot.finale?.reason,
              snapshot: generated.snapshot, ending: generated.ending,
              error: generated.usedFallback && generated.errors.length ? generated.errors.join('; ') : undefined } }
            this.write(locked, now); response = this.view(locked)
            this.sql.exec('INSERT INTO ending_cache VALUES (?, ?, ?, ?)', owner, body.ending_id, requestHash, JSON.stringify(response))
          })
          return json(response)
        }

        const mutation = url.pathname.match(/^\/api\/story\/sessions\/([^/]+)\/mutations$/)
        if (mutation && request.method === 'POST') {
          if (!options.applyMutation) return error('MUTATION_UNAVAILABLE', 404)
          const sessionId = decodeURIComponent(mutation[1]); const current = this.session(sessionId, owner)
          if (!current) return error('SESSION_NOT_FOUND', 404)
          const body = await request.json() as Record<string, any>
          if (!stableId(body.mutation_id) || !safeInt(body.expected_version) || body.ruleset_version !== current.rulesetVersion || !body.mutation) return error('INVALID_MUTATION')
          const requestHash = await digest({ expected_version: body.expected_version, ruleset_version: body.ruleset_version, mutation: body.mutation })
          const cached = this.one('SELECT request_hash, response_json FROM mutation_cache WHERE owner = ? AND mutation_id = ?', owner, body.mutation_id)
          if (cached) return cached.request_hash === requestHash ? json(JSON.parse(cached.response_json)) : error('MUTATION_ID_CONFLICT', 409)
          if (body.expected_version !== current.version) return error('VERSION_CONFLICT', 409)
          let response: any
          this.ctx.storage.transactionSync(() => {
            const locked = this.session(sessionId, owner); if (!locked || locked.version !== current.version) throw new Error('VERSION_CONFLICT')
            const next = options.applyMutation!(structuredClone(locked.snapshot), body.mutation)
            if (!this.validSave(next)) throw new Error('INVALID_MUTATION_RESULT')
            locked.version += 1; locked.cursor += 1; locked.snapshot = next
            const event = { seq: locked.cursor, version: locked.version, action_id: body.mutation_id, source: 'external' }
            locked.events.push(event); this.write(locked, now)
            this.sql.exec('INSERT INTO events VALUES (?, ?, ?, ?, ?)', sessionId, event.seq, event.version, event.action_id, event.source)
            response = this.view(locked)
            this.sql.exec('INSERT INTO mutation_cache VALUES (?, ?, ?, ?)', owner, body.mutation_id, requestHash, JSON.stringify(response))
          })
          return json(response)
        }

        const match = url.pathname.match(/^\/api\/story\/sessions\/([^/]+)(\/turns)?$/)
        if (!match) return error('NOT_FOUND', 404)
        const sessionId = decodeURIComponent(match[1]); const current = this.session(sessionId, owner)
        if (!current) return error('SESSION_NOT_FOUND', 404)
        if (request.method === 'GET' && !match[2]) return json(this.view(current, Math.max(0, Number(url.searchParams.get('after_cursor')) || 0)))
        if (request.method !== 'POST' || match[2] !== '/turns') return error('METHOD_NOT_ALLOWED', 405)
        const body = await request.json() as Record<string, any>; const input = body.input as Record<string, any>
        if (!stableId(body.action_id) || !safeInt(body.expected_version) || body.ruleset_version !== current.rulesetVersion) return error('INVALID_ACTION')
        const requestHash = await digest({ expected_version: body.expected_version, ruleset_version: body.ruleset_version, input })
        const cached = this.one('SELECT request_hash, response_json FROM action_cache WHERE owner = ? AND action_id = ?', owner, body.action_id)
        if (cached) return cached.request_hash === requestHash ? json(JSON.parse(cached.response_json)) : error('ACTION_ID_CONFLICT', 409)
        if (body.expected_version !== current.version) return error('VERSION_CONFLICT', 409)
        const action = input?.type === 'choice' && typeof input.definition_id === 'string'
          ? current.snapshot.choices.find(choice => choice.id === input.definition_id)?.label ?? ''
          : input?.type === 'free-input' && typeof input.text === 'string' && input.text.length <= 2_000 ? input.text.trim() : ''
        if (!action) return error('INVALID_ACTION')
        const cartridge = options.resolveCartridge(current.snapshot.locale)
        let executed: { save: StorySave; source: string }
        try { executed = await options.executeTurn({ save: structuredClone(current.snapshot), cartridge, action, locale: current.snapshot.locale, generator: options.generator }) }
        catch { return error('MODEL_UNAVAILABLE', 503) }
        let response: any
        try {
          this.ctx.storage.transactionSync(() => {
            const raced = this.one('SELECT request_hash, response_json FROM action_cache WHERE owner = ? AND action_id = ?', owner, body.action_id)
            if (raced) { if (raced.request_hash !== requestHash) throw new Error('ACTION_ID_CONFLICT'); response = JSON.parse(raced.response_json); return }
            const locked = this.session(sessionId, owner); if (!locked || locked.version !== current.version) throw new Error('VERSION_CONFLICT')
            locked.version += 1; locked.cursor += 1; locked.snapshot = executed.save
            const event = { seq: locked.cursor, version: locked.version, action_id: body.action_id, source: executed.source }
            locked.events.push(event); this.write(locked, now)
            this.sql.exec('INSERT INTO events VALUES (?, ?, ?, ?, ?)', sessionId, event.seq, event.version, event.action_id, event.source)
            response = this.view(locked)
            this.sql.exec('INSERT INTO action_cache VALUES (?, ?, ?, ?)', owner, body.action_id, requestHash, JSON.stringify(response))
          })
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : 'INTERNAL_ERROR'
          if (['VERSION_CONFLICT', 'ACTION_ID_CONFLICT'].includes(code)) return error(code, 409)
          throw cause
        }
        return json(response)
      } catch (cause) {
        const code = cause instanceof Error ? cause.message : 'INTERNAL_ERROR'
        return error(['VERSION_CONFLICT', 'ACTION_ID_CONFLICT', 'ENROLLMENT_ID_CONFLICT'].includes(code) ? code : 'INTERNAL_ERROR', code === 'VERSION_CONFLICT' ? 409 : 500)
      }
    }
  }

  async function handleStoryApi(request: Request, env: any) {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/api/story/health') {
      return json({ ok: true, game: options.gameId, storage: 'durable-object-sqlite', identity_mode: 'anonymous-capability-v1', production_writes: true })
    }
    const auth = request.headers.get('Authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) return error('AUTH_REQUIRED', 401)
    const owner = await digest(token)
    const headers = new Headers(request.headers); headers.delete('Authorization'); headers.set('X-Story-Owner', owner)
    return env.STORY_SESSIONS.get(env.STORY_SESSIONS.idFromName('authority-v1')).fetch(new Request(request, { headers }))
  }

  return { StorySessionAuthority, handleStoryApi }
}
