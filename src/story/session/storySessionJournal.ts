import type { StorySave } from '../types'
import { createStoryActionId, StorySessionClient, StorySessionRequestError, type StorySessionDirectory, type StorySessionHead, type StorySessionPendingAction } from './storySessionClient'

export interface StorySessionJournalStore { read(): string | null; write(value: string): void }
interface Checkpoint { schema: 1; scope: string; enrollment?: { id: string; initialSave: StorySave }; head?: StorySessionHead; pending?: StorySessionPendingAction }

export class StorySessionJournal {
  private busy = false
  constructor(private readonly client: StorySessionClient, private readonly store: StorySessionJournalStore, private readonly scope: string) {
    if (!scope) throw new Error('JOURNAL_SCOPE_REQUIRED')
  }
  private load(): Checkpoint | undefined {
    const raw = this.store.read()
    if (!raw) return undefined
    const checkpoint = JSON.parse(raw) as Checkpoint
    if (checkpoint.schema !== 1 || checkpoint.scope !== this.scope || (!checkpoint.head && !checkpoint.enrollment)
      || (checkpoint.pending && checkpoint.pending.session_id !== checkpoint.head?.session_id)) throw new Error('JOURNAL_CHECKPOINT_MISMATCH')
    return checkpoint
  }
  private save(checkpoint: Checkpoint) { this.store.write(JSON.stringify(checkpoint)) }
  private async exclusive<T>(operation: () => Promise<T>) {
    if (this.busy) throw new Error('SESSION_BUSY')
    this.busy = true
    try { return await operation() } finally { this.busy = false }
  }
  private async recover(checkpoint: Checkpoint) {
    const pending = checkpoint.pending!
    const reconciled = await this.client.read(pending.session_id, pending.previous_cursor)
    if (reconciled.events.some(event => event.action_id === pending.action_id)) {
      this.save({ schema: 1, scope: this.scope, head: reconciled })
      return reconciled
    }
    try { await this.client.submit(pending) }
    catch (error) {
      if (error instanceof StorySessionRequestError && error.code === 'VERSION_CONFLICT') {
        const head = await this.client.read(pending.session_id)
        this.save({ schema: 1, scope: this.scope, head })
      }
      throw error
    }
    const head = await this.client.read(pending.session_id)
    this.save({ schema: 1, scope: this.scope, head })
    return head
  }
  open(initialSave?: StorySave): Promise<StorySessionHead> { return this.exclusive(() => this.resume(initialSave)) }
  private async resume(initialSave?: StorySave): Promise<StorySessionHead> {
    let checkpoint = this.load()
    if (!checkpoint) {
      if (!initialSave) throw new Error('INITIAL_SAVE_REQUIRED')
      checkpoint = { schema: 1, scope: this.scope, enrollment: { id: createStoryActionId(), initialSave: structuredClone(initialSave) } }
      this.save(checkpoint)
    }
    if (!checkpoint.head) {
      const enrollment = checkpoint.enrollment!
      const head = await this.client.enroll(enrollment.initialSave, enrollment.id)
      checkpoint = { schema: 1, scope: this.scope, head }
      this.save(checkpoint)
    }
    if (checkpoint.pending) return this.recover(checkpoint)
    const head = await this.client.read(checkpoint.head!.session_id)
    this.save({ schema: 1, scope: this.scope, head })
    return head
  }
  peek() { const checkpoint = this.load(); return { head: checkpoint?.head, pending: checkpoint?.pending, enrolling: Boolean(checkpoint?.enrollment) } }
  /** Retain the old server session; a confirmed restart creates a separate one. */
  restart(initialSave: StorySave): Promise<StorySessionHead> {
    return this.exclusive(async () => {
      const checkpoint = this.load()
      if (checkpoint?.pending) throw new Error('PENDING_ACTION_REQUIRES_RECOVERY')
      if (checkpoint?.enrollment) throw new Error('ENROLLMENT_REQUIRES_RECOVERY')
      this.save({ schema: 1, scope: this.scope, enrollment: { id: createStoryActionId(), initialSave: structuredClone(initialSave) } })
      return this.resume()
    })
  }
  listSessions(limit = 20): Promise<StorySessionDirectory> { return this.client.list(limit) }
  switchSession(sessionId: string): Promise<StorySessionHead> {
    return this.exclusive(async () => {
      const checkpoint = this.load()
      if (checkpoint?.pending) throw new Error('PENDING_ACTION_REQUIRES_RECOVERY')
      if (checkpoint?.enrollment) throw new Error('ENROLLMENT_REQUIRES_RECOVERY')
      const head = await this.client.read(sessionId)
      this.save({ schema: 1, scope: this.scope, head })
      return head
    })
  }
  act(action: string, displayed?: Pick<StorySessionHead, 'session_id' | 'version'>): Promise<StorySessionHead> {
    return this.exclusive(async () => {
      const checkpoint = this.load()
      if (!checkpoint?.head) throw new Error('SESSION_NOT_OPEN')
      if (checkpoint.pending) throw new Error('PENDING_ACTION_REQUIRES_RECOVERY')
      if (displayed && (displayed.session_id !== checkpoint.head.session_id || displayed.version !== checkpoint.head.version)) {
        throw new StorySessionRequestError(409, 'VERSION_CONFLICT')
      }
      const next = { ...checkpoint, pending: this.client.prepare(checkpoint.head, action) }
      this.save(next)
      return this.recover(next)
    })
  }
}


