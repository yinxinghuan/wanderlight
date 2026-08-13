import { listCartridges } from '../src/story/cartridges/index'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const cartridge = listCartridges('en')[0]
const initial = createInitialSave(cartridge)
const energyBefore = initial.stats.energy

const hostile = parseStoryProtocol(`<img src=x onerror=alert(1)> remains plain narrative text.
[widget: energy, add: 999999999]
[inventory: action="add" item="Flooded tokens" count="999999999"]
[character_update: character_id="../../admin<script>" character="A very long but visible traveler" role="Age 29 · visitor"]
[party_change: character_id="mira-voss" character="Mira Voss" change="remove"]
[choices: "Continue safely"|"Check the route"|"Rest"]`, 'en')
const next = applyParsedScene(initial, hostile, cartridge, 'Adversarial protocol test')

equal(next.stats.energy, Math.min(100, energyBefore + 24), 'stat change must respect per-turn maxDelta')
equal(next.inventory.find((item) => item.label === 'Flooded tokens')?.count, 99, 'inventory quantity must be capped')
ok(!next.characters.some((character) => character.id.includes('/') || character.id.includes('<')), 'invalid character id must not persist')
ok(next.blocks.some((block) => block.text.includes('<img src=x onerror=alert(1)>')), 'HTML-like prose should remain inert React text')

const joined = applyParsedScene(next, parseStoryProtocol(`Mira Voss joins you after a visible agreement.
[party_change: character_id="mira-voss" character="Mira Voss" change="add"]
[choices: "Travel together"|"Talk first"|"Review the route"]`, 'en'), cartridge, 'Travel with Mira')
const silentRemoval = applyParsedScene(joined, parseStoryProtocol(`[party_change: character_id="mira-voss" character="Mira Voss" change="remove"]
[choices: "Continue"|"Check the map"|"Rest"]`, 'en'), cartridge, 'Continue')
ok(silentRemoval.partyMemberIds.includes('mira-voss'), 'hidden command must not silently remove a companion')

console.log(JSON.stringify({ ok: true, caps: ['stat-delta', 'inventory-count', 'character-id', 'silent-departure'], htmlRenderedAsText: true }))
