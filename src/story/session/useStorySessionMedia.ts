import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGenImage } from '../../shared/runtime/useGenImage'
import { createMediaRequestId } from '../../shared/runtime/media'
import type { StoryCartridge, StorySave } from '../types'
import type { StorySessionHead } from './storySessionClient'
import { StorySessionJournal } from './storySessionJournal'

interface MediaIdentity { ready: boolean; refUrl?: string }
interface PendingMedia { entityId: string; kind: 'block' | 'inventory'; prompt: string; playerVisible: boolean }

function nextMedia(save: StorySave, queuedItems: ReadonlySet<string>): PendingMedia | undefined {
  const block = [...save.blocks].reverse().find(candidate => candidate.kind === 'image'
    && ['idle', 'queued', 'failed'].includes(String(candidate.data?.status ?? 'idle'))
    && Boolean(String(candidate.data?.prompt ?? '').trim()))
  if (block) return { entityId: block.id, kind: 'block', prompt: String(block.data?.prompt), playerVisible: block.data?.playerVisible === 'true' }
  const item = save.inventory.find(candidate => (candidate.imageStatus === 'queued' || queuedItems.has(candidate.id)) && Boolean(candidate.imagePrompt?.trim()))
  if (item) return { entityId: item.id, kind: 'inventory', prompt: item.imagePrompt!, playerVisible: false }
  return undefined
}

export function useStorySessionMedia(options: {
  cartridge: StoryCartridge
  head?: StorySessionHead
  journal: StorySessionJournal
  identity: MediaIdentity
  enabled?: boolean
  adopt(head: StorySessionHead): void
}) {
  const { cartridge, head, journal, identity, adopt, enabled = Boolean(head?.snapshot.entered) } = options
  const { generate } = useGenImage()
  const [active, setActive] = useState<string>()
  const [failed, setFailed] = useState<Record<string, true>>({})
  const [queuedItems, setQueuedItems] = useState<Set<string>>(() => new Set())
  const attempted = useRef(new Set<string>())
  const candidate = useMemo(() => head ? nextMedia(head.snapshot, queuedItems) : undefined, [head, queuedItems])

  useEffect(() => {
    if (!head || !enabled || !candidate || active || failed[candidate.entityId]) return
    if (candidate.playerVisible && (!identity.ready || !identity.refUrl)) return
    const key = `${head.session_id}:${candidate.entityId}`
    if (attempted.current.has(key)) return
    attempted.current.add(key)
    const storageKey = `story-media-request:${key}`
    const requestId = alteruLocalStorage.getItem(storageKey) || createMediaRequestId()
    alteruLocalStorage.setItem(storageKey, requestId)
    setActive(candidate.entityId)
    const mediaDirector = (cartridge as StoryCartridge & { mediaDirector?: { imageTarget?: { width: number; height: number }; imageProfile?: 'fast-small' | 'standard' } }).mediaDirector
    const target = mediaDirector?.imageTarget ?? { width: 640, height: 360 }
    void (generate as unknown as (request: Record<string, unknown>) => Promise<string | { url: string }>)({
      requestId,
      prompt: candidate.kind === 'inventory'
        ? `${candidate.prompt}. Isolated story inventory object, no text, no UI, consistent with ${cartridge.sceneImageDirection ?? cartridge.theme.material}.`
        : candidate.prompt,
      ...(candidate.playerVisible && identity.refUrl ? { ref_url: identity.refUrl } : {}),
      requestedSize: target,
      width: target.width,
      height: target.height,
      profile: mediaDirector?.imageProfile ?? 'fast-small',
      referenceMode: 'edit',
      timeoutMs: 60_000,
    }).then(async result => {
      const url = typeof result === 'string' ? result : result.url
      const next = await journal.attachMedia(head.session_id, candidate.entityId, requestId, candidate.kind, url)
      alteruLocalStorage.removeItem(storageKey)
      setQueuedItems(current => { const nextItems = new Set(current); nextItems.delete(candidate.entityId); return nextItems })
      adopt(next)
    }).catch(() => setFailed(current => ({ ...current, [candidate.entityId]: true })))
      .finally(() => setActive(undefined))
  }, [active, adopt, candidate, cartridge, enabled, failed, generate, head, identity, journal])

  const retry = useCallback((entityId: string) => {
    if (!head) return
    attempted.current.delete(`${head.session_id}:${entityId}`)
    setFailed(current => { const next = { ...current }; delete next[entityId]; return next })
  }, [head])

  const prepareInventory = useCallback(() => {
    if (!head) return
    setQueuedItems(current => new Set([
      ...current,
      ...head.snapshot.inventory.filter(item => item.imageStatus !== 'ready' && item.imagePrompt?.trim()).map(item => item.id),
    ]))
  }, [head])

  const save = useMemo(() => {
    if (!head) return undefined
    return {
      ...head.snapshot,
      blocks: head.snapshot.blocks.map(block => block.id === active
        ? { ...block, data: { ...block.data, status: 'generating' } }
        : failed[block.id] ? { ...block, data: { ...block.data, status: 'failed' } } : block),
      inventory: head.snapshot.inventory.map(item => item.id === active
        ? { ...item, imageStatus: 'generating' as const }
        : failed[item.id] ? { ...item, imageStatus: 'failed' as const } : item),
    }
  }, [active, failed, head])
  return { save, retry, prepareInventory }
}
