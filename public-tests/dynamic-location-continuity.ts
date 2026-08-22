import { listCartridges } from '../src/story/cartridges/index'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { filterGroundedChoices } from '../src/story/engine/continuity'
import { applyDisplayedRouteFallback, applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import {
  canonicalizeTurnMetadata,
  inferActionDestination,
  repairPersistedMapRouteHints,
  stableDynamicLocationId,
  validateTurnConsistency,
} from '../src/story/engine/turnConsistency'
import type { Locale, MapNode, StoryCartridge, StorySave } from '../src/story/types'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

function atOpening(save: StorySave, cartridge: StoryCartridge): StorySave {
  return {
    ...save,
    location: cartridge.opening.location,
    sceneLocation: cartridge.opening.location,
    map: save.map.map((node) => ({ ...node, current: node.label === cartridge.opening.location })),
  }
}

function placeData(locale: Locale, index: number) {
  const suffix = String(index + 1).padStart(2, '0')
  return locale === 'zh'
    ? {
        id: `user-place-zh-${suffix}`,
        label: `苔钟谷${suffix}`,
        alias: `荧光谷${suffix}`,
        sublocation: `旧磨坊后门${suffix}`,
        laterAlias: `北坡石径${suffix}`,
        hiddenAlias: `隐藏别名${suffix}`,
        move: (name: string) => `前往${name}查看水渠`,
        discussion: (name: string) => `询问${name}的来历，但留在原地`,
        arrive: (name: string) => `你离开月台，沿着确认的路线抵达${name}。`,
        detail: (alias: string, sub: string) => `${alias}里的${sub}靠近一条旧水渠`,
      }
    : {
        id: `user-place-en-${suffix}`,
        label: `Mossbell Vale ${suffix}`,
        alias: `Glow Vale ${suffix}`,
        sublocation: `Old Mill Back Gate ${suffix}`,
        laterAlias: `North Slope Path ${suffix}`,
        hiddenAlias: `Hidden Alias ${suffix}`,
        move: (name: string) => `Travel to ${name} and inspect the watercourse`,
        discussion: (name: string) => `Ask about ${name} while remaining here`,
        arrive: (name: string) => `You leave the platform and follow the confirmed route until you arrive at ${name}.`,
        detail: (alias: string, sub: string) => `${sub} stands beside an old watercourse in ${alias}`,
      }
}

let assertions = 0
const check = (value: unknown, message: string) => { assertions += 1; ok(value, message) }
const expect = (actual: unknown, expected: unknown, message: string) => { assertions += 1; equal(actual, expected, message) }

for (const locale of ['zh', 'en'] as const) {
  const cartridge = listCartridges(locale)[0]
  let save = createInitialSave(cartridge)
  const created: MapNode[] = []

  for (let index = 0; index < 60; index += 1) {
    const data = placeData(locale, index)
    save = atOpening(save, cartridge)
    const prose = `${data.arrive(data.label)} ${data.detail(data.alias, data.sublocation)}.`
    const raw = `${prose}
[map_update: new_location="${data.label}" location_id="${data.id}" connected_to="${cartridge.opening.location}" detail="${data.detail(data.alias, data.sublocation)}" route_hints="${data.alias}|${data.sublocation}|${data.hiddenAlias}"]
[scene_location: location="${data.sublocation}"]
[choices: "${locale === 'zh' ? `检查${data.sublocation}的水渠` : `Inspect the watercourse at ${data.sublocation}`}"]`
    const parsed = parseStoryProtocol(raw, locale)
    const mapCommand = parsed.commands.find((command) => command.type === 'map_update')
    check(mapCommand?.type === 'map_update', `${locale} dynamic map command parses`)
    if (mapCommand?.type === 'map_update') {
      expect(mapCommand.locationId, data.id, `${locale} stable dynamic id parses`)
      expect(mapCommand.routeHints?.length, 3, `${locale} alias list parses before visible validation`)
    }
    const canonical = canonicalizeTurnMetadata(save, parsed, cartridge)
    expect(validateTurnConsistency(save, canonical.parsed, cartridge).length, 0, `${locale} dynamic sublocation passes the full location contract`)
    save = applyParsedScene(save, canonical.parsed, cartridge, data.move(data.label))
    const node = save.map.find((entry) => entry.id === data.id)
    check(node, `${locale} dynamic node persists by protocol id`)
    expect(node.label, data.label, `${locale} dynamic label persists`)
    check(node.routeHints?.includes(data.alias), `${locale} visible alias persists`)
    check(node.routeHints?.includes(data.sublocation), `${locale} visible sublocation persists`)
    check(!node.routeHints?.includes(data.hiddenAlias), `${locale} hidden prompt-only alias is discarded`)
    expect(save.sceneLocation, data.sublocation, `${locale} exact generated sublocation remains visible`)
    created.push(node)

    const aliasUpdate = parseStoryProtocol(`${locale === 'zh' ? `你仍在${data.label}，当地人把通往水渠的路称作${data.laterAlias}。` : `You remain in ${data.label}; locals call the watercourse route ${data.laterAlias}.`}
[map_update: new_location="${data.label}" location_id="${data.id}" route_hints="${data.laterAlias}"]
[scene_location: location="${data.sublocation}"]
[choices: "${locale === 'zh' ? `沿${data.laterAlias}检查路标` : `Inspect the signs along ${data.laterAlias}`}"]`, locale)
    save = applyParsedScene(save, aliasUpdate, cartridge, locale === 'zh' ? '记住当地叫法' : 'Remember the local name')
    expect(save.map.filter((entry) => entry.id === data.id).length, 1, `${locale} alias updates do not duplicate a dynamic node`)
    check(save.map.find((entry) => entry.id === data.id)?.routeHints?.includes(data.laterAlias), `${locale} later visible alias merges into the node`)

    const origin = atOpening(save, cartridge)
    expect(inferActionDestination(origin, cartridge, data.move(data.alias))?.id, data.id, `${locale} alias revisit resolves to stable id`)
    expect(inferActionDestination(origin, cartridge, data.move(data.sublocation))?.id, data.id, `${locale} sublocation revisit resolves to parent id`)
    expect(inferActionDestination(origin, cartridge, data.move(data.laterAlias))?.id, data.id, `${locale} later alias revisit resolves to stable id`)
    expect(inferActionDestination(origin, cartridge, data.discussion(data.alias)), undefined, `${locale} discussion without movement cannot teleport`)
    expect(inferActionDestination(origin, cartridge, data.move(data.hiddenAlias)), undefined, `${locale} discarded hidden alias cannot become a route`)

    const omittedUpdate = parseStoryProtocol(`${data.arrive(data.sublocation)}
[scene_location: location="${data.sublocation}"]
[choices: "${locale === 'zh' ? `检查${data.sublocation}的水渠` : `Inspect the watercourse at ${data.sublocation}`}"]`, locale)
    const repaired = canonicalizeTurnMetadata(origin, omittedUpdate, cartridge, undefined, data.move(data.alias))
    const synthesized = repaired.parsed.commands.find((command) => command.type === 'map_update')
    check(synthesized?.type === 'map_update', `${locale} omitted dynamic route update is synthesized`)
    if (synthesized?.type === 'map_update') expect(synthesized.locationId, data.id, `${locale} synthesized route keeps stable id`)
    expect(validateTurnConsistency(origin, repaired.parsed, cartridge, undefined, data.move(data.alias)).length, 0, `${locale} synthesized dynamic route validates`)

    const offer = parseStoryProtocol(`${locale === 'zh' ? `站牌写明${data.alias}和${data.sublocation}已经开放。` : `The route board says ${data.alias} and ${data.sublocation} are open.`}
[scene_location: location="${cartridge.opening.location}"]
[choices: "${data.move(data.alias)}"]`, locale)
    const offered = applyParsedScene(origin, offer, cartridge, locale === 'zh' ? '查看路线牌' : 'Read the route board')
    expect(offered.choices.length, 1, `${locale} grounded dynamic route remains visible`)
    expect(offered.choices[0]?.targetLocationId, data.id, `${locale} displayed route binds a stable target id before click`)

    const hostileRename = parseStoryProtocol(`${locale === 'zh' ? `你看见有人把旧路牌改成了伪造名称。` : `You see someone replace the old sign with a forged name.`}
[map_update: new_location="${locale === 'zh' ? `伪造地点${index}` : `Forged Place ${index}`}" location_id="${data.id}"]
[scene_location: location="${locale === 'zh' ? `伪造地点${index}` : `Forged Place ${index}`}"]
[choices: "${locale === 'zh' ? '留在原地核对地图' : 'Stay and verify the map'}"]`, locale)
    check(validateTurnConsistency(origin, hostileRename, cartridge).includes('turn.location_id_cannot_rename_place'), `${locale} reused id cannot silently rename a known dynamic place`)
  }

  const origin = atOpening(save, cartridge)
  const first = created[0]
  const fallbackAction = locale === 'zh' ? `前往${first.routeHints?.[1]}` : `Travel to ${first.routeHints?.[1]}`
  const fallback = applyDisplayedRouteFallback(origin, cartridge, fallbackAction, first)
  expect(fallback.location, first.label, `${locale} local fallback executes the bound dynamic destination`)
  expect(fallback.map.find((node) => node.id === first.id)?.current, true, `${locale} fallback preserves the dynamic stable id`)

  const sharedAlias = locale === 'zh' ? '旧桥口' : 'Old Bridgehead'
  const collisionA: MapNode = { id: `collision-${locale}-a`, label: locale === 'zh' ? '东岸村' : 'Eastbank Village', routeHints: [sharedAlias], visited: true }
  const collisionB: MapNode = { id: `collision-${locale}-b`, label: locale === 'zh' ? '西岸村' : 'Westbank Village', routeHints: [sharedAlias], visited: true }
  const ambiguous = { ...origin, map: [...origin.map, collisionA, collisionB] }
  const ambiguousAction = locale === 'zh' ? `前往${sharedAlias}` : `Travel to ${sharedAlias}`
  expect(inferActionDestination(ambiguous, cartridge, ambiguousAction), undefined, `${locale} colliding aliases refuse to guess`)
  const exactAction = locale === 'zh' ? `前往${collisionA.label}` : `Travel to ${collisionA.label}`
  expect(inferActionDestination(ambiguous, cartridge, exactAction)?.id, collisionA.id, `${locale} exact canonical name wins despite alias collision`)

  const routeOnlyAlias = locale === 'zh' ? '远岸工棚' : 'Xylophonic Hypercube'
  const routeOnlySave = { ...origin, map: [...origin.map, { id: `route-only-${locale}`, label: locale === 'zh' ? '远岸' : 'Far Bank', routeHints: [routeOnlyAlias], visited: true }] }
  const unsupportedLocalChoice = locale === 'zh' ? `在${routeOnlyAlias}雕刻星辉王冠` : `Forge a quantum submarine at ${routeOnlyAlias}`
  expect(filterGroundedChoices([{ id: 'unsupported', label: unsupportedLocalChoice }], routeOnlySave, cartridge).length, 0, `${locale} a route alias alone cannot invent an executable local activity`)
  const validRouteChoice = locale === 'zh' ? `前往${routeOnlyAlias}` : `Travel to ${routeOnlyAlias}`
  expect(inferActionDestination(routeOnlySave, cartridge, validRouteChoice)?.id, `route-only-${locale}`, `${locale} the same alias still proves a movement route`)

  const legacy = created[1]
  const legacyScene = locale === 'zh' ? `${legacy.label}旧塔脚` : `${legacy.label} Old Tower Foot`
  const migrated = repairPersistedMapRouteHints(
    [{ ...legacy, current: true, routeHints: undefined }],
    legacyScene,
    [{ id: 'legacy-visible', kind: 'narration', text: locale === 'zh' ? `你抵达${legacyScene}。` : `You arrive at ${legacyScene}.` }],
    cartridge,
  )[0]
  check(migrated.routeHints?.includes(legacy.label), `${locale} old dynamic save recovers its canonical label`)
  check(migrated.routeHints?.includes(legacyScene), `${locale} old dynamic save recovers a visibly proved current sublocation`)

  const fallbackIdA = stableDynamicLocationId(locale === 'zh' ? '没有模型 ID 的地方' : 'A Place Without Model ID')
  const fallbackIdB = stableDynamicLocationId(locale === 'zh' ? '没有模型 ID 的地方' : 'A Place Without Model ID')
  expect(fallbackIdA, fallbackIdB, `${locale} fallback dynamic id is deterministic`)

  const aliasTarget = created[2]
  const aliasAction = locale === 'zh' ? '我决定把这里叫做晨雾坡' : 'I decide to call this place Morning Mist Slope'
  const aliasName = locale === 'zh' ? '晨雾坡' : 'Morning Mist Slope'
  const aliasBase = { ...origin, location: aliasTarget.label, sceneLocation: aliasTarget.label, map: origin.map.map((node) => ({ ...node, current: node.id === aliasTarget.id })) }
  const aliasTurn = parseStoryProtocol(`${locale === 'zh' ? '你把这个名字写在自己的路线簿上。' : 'You write that name in your route book.'}
[scene_location: location="${aliasTarget.label}"]
[choices: "${locale === 'zh' ? '查看路线簿' : 'Inspect the route book'}"]`, locale)
  const aliasSaved = applyParsedScene(aliasBase, aliasTurn, cartridge, aliasAction)
  check(aliasSaved.map.find((node) => node.id === aliasTarget.id)?.routeHints?.includes(aliasName), `${locale} explicit player-authored place name persists without model metadata`)
  const aliasOrigin = atOpening(aliasSaved, cartridge)
  const aliasRoute = locale === 'zh' ? `前往${aliasName}` : `Travel to ${aliasName}`
  expect(inferActionDestination(aliasOrigin, cartridge, aliasRoute)?.id, aliasTarget.id, `${locale} explicit player-authored name is immediately routable`)
}

console.log(JSON.stringify({ ok: true, simulatedPlaces: 120, assertions, coverage: [
  'stable-id', 'visible-alias-validation', 'dynamic-sublocation', 'alias-merge', 'no-duplicate-node',
  'alias-revisit', 'displayed-target-binding', 'omitted-map-update-repair', 'discussion-guard',
  'collision-refusal', 'exact-name-precedence', 'id-rename-rejection', 'player-authored-alias',
  'legacy-save-repair', 'local-route-fallback', 'zh-en',
] }))
