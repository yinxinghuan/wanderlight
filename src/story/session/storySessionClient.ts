import { getGameApiBase } from '../../shared/runtime/game-id'
import type { StorySave } from '../types'

export type StorySessionInput =
  | { type: 'choice'; definition_id: string }
  | { type: 'free-input'; text: string }

export interface StorySessionEvent {
  seq: number
  version: number
  action_id: string
  source: string
}

export interface StorySessionHead {
  session_id: string
  ruleset_version: number
  version: number
  cursor: number
  snapshot: StorySave
  events: StorySessionEvent[]
}

export interface StorySessionSummary {
  session_id: string
  ruleset_version: number
  version: number
  cursor: number
  locale: 'zh' | 'en'
  scene: number
  created_at: number
  updated_at: number
}

export interface StorySessionDirectory { sessions: StorySessionSummary[] }

export interface StorySessionMigrationResult extends StorySessionHead {
  ok: true
  migration_id: string
  migrated_from_version: number
  migrated_to_version: number
  snapshot_changed: boolean
  replayed: boolean
}

export interface StorySessionPendingAction {
  session_id: string
  action_id: string
  expected_version: number
  ruleset_version: number
  previous_cursor: number
  input: StorySessionInput
}

export interface StorySessionTransport {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export class StorySessionRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message = code) {
    super(message)
    this.name = 'StorySessionRequestError'
  }
}

export function createStorySessionHttpTransport(options: {
  apiBase?: string
  fetcher?: typeof fetch
  headers?: () => HeadersInit
  timeoutMs?: number
} = {}): StorySessionTransport {
  const apiBase = (options.apiBase ?? getGameApiBase()).replace(/\/$/, '')
  const fetcher = options.fetcher ?? fetch
  const timeoutMs = options.timeoutMs ?? 75_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('INVALID_STORY_TIMEOUT')
  return {
    async request<T>(path: string, init: RequestInit = {}) {
      const headers = new Headers(options.headers?.())
      headers.set('Content-Type', 'application/json')
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
      const controller = new AbortController()
      const abort = () => controller.abort()
      if (init.signal?.aborted) abort()
      else init.signal?.addEventListener('abort', abort, { once: true })
      const timer = globalThis.setTimeout(abort, timeoutMs)
      try {
        const response = await fetcher(`${apiBase}${path}`, { ...init, credentials: 'same-origin', headers, signal: controller.signal })
        const payload = await response.json() as { code?: string; message?: string }
        if (!response.ok) throw new StorySessionRequestError(response.status, payload.code ?? `HTTP_${response.status}`, payload.message)
        return payload as T
      } finally {
        globalThis.clearTimeout(timer)
        init.signal?.removeEventListener('abort', abort)
      }
    },
  }
}

function checkedHead(value: unknown, sessionId?: string): StorySessionHead {
  const head = value as StorySessionHead | undefined
  if (!head || typeof head.session_id !== 'string' || !head.session_id
    || (sessionId !== undefined && head.session_id !== sessionId)
    || !Number.isSafeInteger(head.ruleset_version) || head.ruleset_version < 1
    || !Number.isSafeInteger(head.version) || head.version < 0
    || !Number.isSafeInteger(head.cursor) || head.cursor < 0
    || head.snapshot?.version !== 10 || !Array.isArray(head.snapshot.blocks)
    || !Array.isArray(head.snapshot.choices) || !Array.isArray(head.events)
    || !head.events.every(event => Number.isSafeInteger(event.seq) && event.seq > 0 && event.seq <= head.cursor
      && Number.isSafeInteger(event.version) && typeof event.action_id === 'string' && typeof event.source === 'string')) {
    throw new Error('INVALID_STORY_SESSION_HEAD')
  }
  return head
}

function checkedDirectory(value: unknown): StorySessionDirectory {
  const directory = value as StorySessionDirectory | undefined
  if (!directory || !Array.isArray(directory.sessions) || directory.sessions.length > 50
    || !directory.sessions.every(entry => typeof entry.session_id === 'string' && entry.session_id.length > 0
      && Number.isSafeInteger(entry.ruleset_version) && entry.ruleset_version > 0
      && Number.isSafeInteger(entry.version) && entry.version >= 0
      && Number.isSafeInteger(entry.cursor) && entry.cursor >= 0
      && (entry.locale === 'zh' || entry.locale === 'en')
      && Number.isSafeInteger(entry.scene) && entry.scene >= 0
      && Number.isSafeInteger(entry.created_at) && entry.created_at >= 0
      && Number.isSafeInteger(entry.updated_at) && entry.updated_at >= 0)
    || new Set(directory.sessions.map(entry => entry.session_id)).size !== directory.sessions.length) throw new Error('INVALID_STORY_SESSION_DIRECTORY')
  return directory
}

function inputFor(save: StorySave, action: string): StorySessionInput {
  const normalized = action.trim()
  if (!normalized) throw new Error('Story action is required')
  const choice = save.choices.find(candidate => candidate.label.trim() === normalized)
  return choice ? { type: 'choice', definition_id: choice.id } : { type: 'free-input', text: normalized.slice(0, 2_000) }
}

export function createStoryActionId() { return crypto.randomUUID() }

export class StorySessionClient {
  constructor(private readonly transport: StorySessionTransport, private readonly rulesetVersion = 1) {}

  async enroll(initialSave: StorySave, enrollmentId: string = createStoryActionId()) {
    return checkedHead(await this.transport.request('/api/story/sessions', {
      method: 'POST', body: JSON.stringify({ enrollment_id: enrollmentId, initial_save: initialSave, initial_version: initialSave.scene }),
    }))
  }

  async read(sessionId: string, afterCursor = 0) {
    return checkedHead(await this.transport.request(`/api/story/sessions/${encodeURIComponent(sessionId)}?after_cursor=${Math.max(0, afterCursor)}`), sessionId)
  }

  async list(limit = 20): Promise<StorySessionDirectory> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error('INVALID_SESSION_LIMIT')
    return checkedDirectory(await this.transport.request(`/api/story/sessions?limit=${limit}`))
  }

  /** Explicit only: callers must never run save repair as a side effect of GET. */
  async migrate(sessionId: string, migrationId: string, expectedVersion: number, rulesetVersion = this.rulesetVersion): Promise<StorySessionMigrationResult> {
    const value = await this.transport.request(`/api/story/sessions/${encodeURIComponent(sessionId)}/migrations`, {
      method: 'POST', body: JSON.stringify({ migration_id: migrationId, expected_version: expectedVersion, ruleset_version: rulesetVersion }),
    }) as StorySessionMigrationResult
    const checked = checkedHead(value, sessionId)
    if (value.ok !== true || value.migration_id !== migrationId
      || !Number.isSafeInteger(value.migrated_from_version) || !Number.isSafeInteger(value.migrated_to_version)
      || value.migrated_to_version !== value.migrated_from_version + 1
      || typeof value.snapshot_changed !== 'boolean' || typeof value.replayed !== 'boolean') throw new Error('INVALID_STORY_SESSION_MIGRATION_RESULT')
    return { ...value, ...checked }
  }

  prepare(head: StorySessionHead, action: string, actionId = createStoryActionId()): StorySessionPendingAction {
    return { session_id: head.session_id, action_id: actionId, expected_version: head.version,
      ruleset_version: head.ruleset_version || this.rulesetVersion, previous_cursor: head.cursor, input: inputFor(head.snapshot, action) }
  }

  async submit(pending: StorySessionPendingAction): Promise<StorySessionHead> {
    const path = `/api/story/sessions/${encodeURIComponent(pending.session_id)}/turns`
    const body = JSON.stringify({ action_id: pending.action_id, expected_version: pending.expected_version,
      ruleset_version: pending.ruleset_version, input: pending.input })
    try { return checkedHead(await this.transport.request(path, { method: 'POST', body }), pending.session_id) }
    catch (cause) {
      if (cause instanceof StorySessionRequestError && cause.code !== 'VERSION_CONFLICT') throw cause
      const reconciled = await this.read(pending.session_id, pending.previous_cursor)
      if (reconciled.events.some(event => event.action_id === pending.action_id)) return reconciled
      if (cause instanceof StorySessionRequestError) throw cause
      return checkedHead(await this.transport.request(path, { method: 'POST', body }), pending.session_id)
    }
  }
  async attachMedia(sessionId: string, entityId: string, requestId: string, kind: 'block' | 'inventory', url: string) {
    return checkedHead(await this.transport.request(
      `/api/story/sessions/${encodeURIComponent(sessionId)}/media/${encodeURIComponent(entityId)}`,
      { method: 'POST', body: JSON.stringify({ request_id: requestId, kind, url }) },
    ), sessionId)
  }

  async mutate(head: Pick<StorySessionHead, 'session_id' | 'version' | 'ruleset_version'>, mutationId: string, mutation: unknown) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(mutationId)) throw new Error('INVALID_MUTATION_REQUEST')
    return checkedHead(await this.transport.request(`/api/story/sessions/${encodeURIComponent(head.session_id)}/mutations`, {
      method: 'POST', body: JSON.stringify({ mutation_id: mutationId, expected_version: head.version, ruleset_version: head.ruleset_version, mutation }),
    }), head.session_id)
  }

}


