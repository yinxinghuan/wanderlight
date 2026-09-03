import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoryEngineView } from '../StoryShell'
import type { StoryCartridge, StorySave } from '../types'
import { createInitialSave } from '../engine/reducer'
import { t } from '../i18n'
import { StorySessionRequestError, type StorySessionHead } from './storySessionClient'
import { StorySessionJournal } from './storySessionJournal'

/** Isolated local UI canary. It never calls the legacy cloud writer or a live model. */
export function useStorySessionEngine(options: { cartridge: StoryCartridge; journal: StorySessionJournal; scope: string; initialSave: StorySave }): StoryEngineView & { sessionId?: string; version?: number } {
  const { cartridge, journal, scope, initialSave } = options
  const [head, setHead] = useState<StorySessionHead>()
  const headRef = useRef<StorySessionHead>()
  const [entered, setEntered] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(true)
  const [pendingAction, setPendingAction] = useState('')
  const running = useRef(false); const mounted = useRef(false)
  const entryKey = useCallback((id: string) => `story-session-ui:${scope}:${id}:entered`, [scope])
  const adopt = useCallback((next: StorySessionHead) => {
    headRef.current = next; setHead(next)
    setEntered(next.snapshot.scene > 0 || alteruLocalStorage.getItem(entryKey(next.session_id)) === '1')
  }, [entryKey])
  const run = useCallback(async (kind: 'open' | 'act' | 'restart', action = '') => {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setPendingAction(action)
    try {
      if (!navigator.locks) throw new Error('SESSION_LOCK_UNAVAILABLE')
      await navigator.locks.request(`story-session:${scope}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('SESSION_BUSY')
        const next = kind === 'act' ? await journal.act(action, headRef.current) : kind === 'restart' ? await journal.restart(createInitialSave(cartridge)) : await journal.open(initialSave)
        if (mounted.current) { adopt(next); setBlocked(false) }
      })
    } catch (cause) {
      if (mounted.current) {
        const code = cause instanceof StorySessionRequestError ? cause.code : cause instanceof Error ? cause.message : ''
        setError(t(cartridge.locale, code === 'VERSION_CONFLICT' ? 'sessionConflict' : code === 'SESSION_BUSY' ? 'sessionBusy' : code === 'SESSION_LOCK_UNAVAILABLE' ? 'sessionLockUnavailable' : code === 'MODEL_UNAVAILABLE' ? 'sessionModelUnavailable' : 'sessionRecoveryNeeded'))
        setBlocked(true)
        try { const cached = journal.peek().head; if (cached) adopt(cached) } catch { /* fail closed */ }
      }
    } finally { running.current = false; if (mounted.current) { setBusy(false); setPendingAction('') } }
  }, [adopt, cartridge, initialSave, journal, scope])
  useEffect(() => { mounted.current = true; void run('open'); return () => { mounted.current = false } }, [run])
  const enter = useCallback(() => {
    if (!headRef.current || running.current || blocked) return
    try { alteruLocalStorage.setItem(entryKey(headRef.current.session_id), '1'); setEntered(true) }
    catch { setError(t(cartridge.locale, 'sessionRecoveryNeeded')); setBlocked(true) }
  }, [blocked, cartridge.locale, entryKey])
  const snapshot = head?.snapshot ?? initialSave
  const save: StorySave = { ...snapshot, entered, blocks: snapshot.blocks.map(block => block.kind === 'image' && block.data?.status !== 'ready' ? { ...block, data: { ...block.data, status: 'idle' } } : block) }
  const listSessions = useCallback(() => journal.listSessions(), [journal])
  const switchSession = useCallback(async (sessionId: string) => {
    if (running.current || blocked) throw new Error('SESSION_BUSY')
    running.current = true; setBusy(true); setError('')
    try {
      if (!navigator.locks) throw new Error('SESSION_LOCK_UNAVAILABLE')
      await navigator.locks.request(`story-session:${scope}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('SESSION_BUSY')
        const next = await journal.switchSession(sessionId); if (mounted.current) adopt(next)
      })
    } catch (cause) {
      if (mounted.current) setError(t(cartridge.locale, cause instanceof Error && cause.message === 'SESSION_BUSY' ? 'sessionBusy' : 'sessionRecoveryNeeded'))
      throw cause
    } finally { running.current = false; if (mounted.current) setBusy(false) }
  }, [adopt, blocked, cartridge.locale, journal, scope])
  return {
    save, mode: 'aigram', setMode: () => {}, fixedSource: true, fixedLocale: true, preservesSessionOnRestart: true,
    busy, actionBlocked: blocked, loaded: Boolean(head), error, pendingAction,
    progress: busy ? { label: t(cartridge.locale, 'restoring'), percent: 20 } : null, canRetry: blocked && !busy,
    enter, act: async action => { if (!blocked && !running.current && entered) await run('act', action) }, retryAction: () => { void run('open') },
    restartWorld: () => { if (!blocked && !running.current) void run('restart') }, useAigramFallback: () => {}, retryImage: () => {}, prepareInventoryImages: () => {}, clear: async () => {},
    listSessions, switchSession, sessionId: head?.session_id, version: head?.version,
  }
}


