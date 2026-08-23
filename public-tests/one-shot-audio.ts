import assert from 'node:assert/strict'
import { StorySynth, shouldReplayRecordedBed } from '../src/story/audio/StorySynth.ts'

class FakeAudio {
  static instances: FakeAudio[] = []
  preload = ''
  currentTime = 0
  volume = 1
  playCalls = 0
  pauseCalls = 0
  onended: (() => void) | null = null

  constructor(public readonly src: string) {
    FakeAudio.instances.push(this)
  }

  play(): Promise<void> {
    this.playCalls += 1
    return Promise.resolve()
  }

  pause(): void {
    this.pauseCalls += 1
  }
}

const previousAudio = globalThis.Audio
const previousWindow = globalThis.window
const previousDocument = globalThis.document

Object.assign(globalThis, {
  Audio: FakeAudio,
  window: { setTimeout, clearTimeout },
  document: { hidden: false },
})

try {
  assert.equal(shouldReplayRecordedBed('music'), true)
  assert.equal(shouldReplayRecordedBed('ambient'), false)

  const theme = {
    material: 'wayfarer',
    bpm: 64,
    rootHz: 146.83,
    scale: [0, 2, 5, 7, 9],
    levels: { music: .05, ambient: .08, sfx: .045, master: .6 },
    recorded: { ambience: { src: 'ambient-test.mp3', gain: .12 } },
  }
  const synth = new StorySynth() as unknown as {
    configure: (...args: unknown[]) => void
    unlocked: boolean
    playRecordedBed: (kind: 'music' | 'ambient') => void
    resumeRecordedBeds: () => void
    dispose: () => void
  }

  const configure = (location: string) => {
    if (synth.configure.length >= 3) synth.configure(theme, .2, location)
    else synth.configure(theme, {
      location,
      scene: 1,
      dangerPhase: 'calm',
      witnessCount: 0,
      finaleActive: false,
      tension: .2,
    })
  }

  configure('dock')
  synth.unlocked = true
  synth.playRecordedBed('ambient')
  const ambience = FakeAudio.instances.at(-1)
  assert.ok(ambience)
  assert.equal(ambience.playCalls, 1, 'first location visit should start ambience once')

  ambience.onended?.()
  synth.resumeRecordedBeds()
  synth.playRecordedBed('ambient')
  configure('dock')
  assert.equal(ambience.playCalls, 1, 'completed ambience must not restart in the same visit')

  configure('yard')
  assert.equal(ambience.playCalls, 2, 'a genuine location change permits one fresh play')
  ambience.onended?.()
  synth.resumeRecordedBeds()
  assert.equal(ambience.playCalls, 2, 'resume must not replay completed ambience')
  synth.dispose()

  console.log('one-shot audio contract passed')
} finally {
  Object.assign(globalThis, {
    Audio: previousAudio,
    window: previousWindow,
    document: previousDocument,
  })
}
