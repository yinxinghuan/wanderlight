import { useEffect, useMemo, useState } from 'react'
import { useGameSave } from '../../shared/save/useGameSave'
import type { StoryArchive, StoryCartridge, StorySave } from '../types'
import { createInitialSave } from '../engine/reducer'
import { normalizeSave } from '../useStoryEngine'
import { createStorySessionHttpTransport, StorySessionClient } from './storySessionClient'
import { StorySessionJournal } from './storySessionJournal'

interface StorySessionBootstrapRecord extends StoryArchive {
  storySession?: { schema: 1; identityMode: 'anonymous-capability-v1'; capability: string }
}

function capabilityToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function archiveFrom(value: unknown): StorySessionBootstrapRecord {
  if (value && typeof value === 'object' && 'worlds' in value) {
    const candidate = value as StorySessionBootstrapRecord
    if (candidate.worlds && typeof candidate.worlds === 'object') return { ...candidate, worlds: { ...candidate.worlds } }
  }
  const legacy = value as Partial<StorySave> | null
  return { version: 1, worlds: legacy?.cartridgeId ? { [legacy.cartridgeId]: legacy as StorySave } : {} }
}

export function useStorySessionBootstrap(gameId: string, cartridge: StoryCartridge) {
  const cloud = useGameSave<StorySessionBootstrapRecord>(gameId)
  const [record, setRecord] = useState<StorySessionBootstrapRecord>()
  useEffect(() => {
    if (!cloud.loaded || record) return
    const archive = archiveFrom(cloud.savedData)
    const capability = archive.storySession?.schema === 1 && archive.storySession.identityMode === 'anonymous-capability-v1'
      ? archive.storySession.capability
      : capabilityToken()
    const next: StorySessionBootstrapRecord = {
      ...archive,
      storySession: { schema: 1, identityMode: 'anonymous-capability-v1', capability },
    }
    setRecord(next)
    cloud.persist(next)
  }, [cloud, record])

  return useMemo(() => {
    const capability = record?.storySession?.capability
    if (!capability) return undefined
    const transport = createStorySessionHttpTransport({ headers: () => ({ Authorization: `Bearer ${capability}` }) })
    const client = new StorySessionClient(transport)
    const scope = `${gameId}:${cartridge.id}:${capability.slice(-12)}`
    const journal = new StorySessionJournal(client, {
      read: () => alteruLocalStorage.getItem(`story-session-journal:${scope}`),
      write: (value) => alteruLocalStorage.setItem(`story-session-journal:${scope}`, value),
    }, scope, true)
    const legacy = record.worlds[cartridge.id]
    const initialSave = normalizeSave(legacy ?? createInitialSave(cartridge), cartridge)
    return { journal, scope, initialSave }
  }, [cartridge, gameId, record])
}
