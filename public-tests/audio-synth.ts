import assert from 'node:assert/strict'
import { chooseStoryAudioCue } from '../src/story/audio/cueDirector'
import { createAmbientTexture, SYNTH_AMBIENT_PROFILE } from '../src/story/audio/StorySynth'
import type { StoryBlock } from '../src/story/types'

function seededRandom(seed = 173): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

const sampleRate = 8_000
const [left, right] = createAmbientTexture(sampleRate, 'wayfarer', seededRandom())
assert.equal(left.length, sampleRate * SYNTH_AMBIENT_PROFILE.textureSeconds)
assert.equal(right.length, left.length)
assert.notDeepEqual(Array.from(left.slice(0, 256)), Array.from(right.slice(0, 256)), 'stereo channels must not duplicate')

function rms(values: Float32Array): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
}

const edge = Math.floor(sampleRate * .08)
const leftStart = rms(left.slice(0, edge))
const leftEnd = rms(left.slice(-edge))
assert.ok(Math.abs(20 * Math.log10(leftStart / leftEnd)) < 4, 'loop edges must remain energy-compatible')
assert.ok(Math.abs(left[0] - left.at(-1)!) < .08, 'loop boundary must not create a large click')

const block = (kind: StoryBlock['kind'], data: StoryBlock['data'] = {}, text = ''): StoryBlock => ({ id: `${kind}-${Math.random()}`, kind, text, data })
assert.equal(chooseStoryAudioCue([block('change', { stat: 'coin', delta: 6 })]), 'coinGain')
assert.equal(chooseStoryAudioCue([block('change', { stat: 'coin', delta: -3 })]), 'coinSpend')
assert.equal(chooseStoryAudioCue([block('change', { stat: 'energy', delta: -7 })]), 'energy')
assert.equal(chooseStoryAudioCue([block('change', { stat: 'renown', delta: 2 })]), 'standing')
assert.equal(chooseStoryAudioCue([block('change', { relationshipChange: 'trusted' })]), 'relationship')
assert.equal(chooseStoryAudioCue([block('event', { arrival: 'Silverleaf' })]), 'travel')
assert.equal(chooseStoryAudioCue([block('change', { itemAction: 'add' })]), 'item')
assert.equal(chooseStoryAudioCue([block('change', { itemAction: 'add', rarity: 'rare' })]), 'treasure')
assert.equal(chooseStoryAudioCue([block('check', { outcome: 'success' })]), 'success')
assert.equal(chooseStoryAudioCue([block('check', { outcome: 'failure' })]), 'failure')
assert.equal(chooseStoryAudioCue([block('narration')]), null)

console.log('audio synth contract passed')
