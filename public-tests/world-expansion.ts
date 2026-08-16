import assert from 'node:assert/strict'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { resolveDeterministicChoiceTurn } from '../src/story/engine/authoredTurns'
import { validateCharacterContinuity } from '../src/story/engine/characterContinuity'
import { resolveDomainAction } from '../src/story/engine/domainRules'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave, mergeAuthoredMapNodes } from '../src/story/engine/reducer'
import type { Locale, StoryCartridge } from '../src/story/types'

const expandedLocations = [
  'windglass-cliffs', 'reedwater-crossing', 'whitecap-baths', 'old-quarry-gardens', 'cloudstep-orchard',
]
const expandedCharacters = [
  'iona-calder', 'luc-maren', 'noor-bell', 'eden-shaw', 'nessa-rill',
]

const cases: Array<{
  locale: Locale
  cartridge: StoryCartridge
  encounters: Array<{ location: string; action: string; characterId: string }>
}> = [
  {
    locale: 'zh', cartridge: wanderlight,
    encounters: [
      { location: '风玻璃崖', action: '去信号塔询问今夜的风向', characterId: 'iona-calder' },
      { location: '芦水渡村', action: '去水闸边询问渡船什么时候开', characterId: 'luc-maren' },
      { location: '白浪浴镇', action: '去公共浴场询问换班工作', characterId: 'noor-bell' },
      { location: '旧石坑花园', action: '沿敲石声走进梯田花园', characterId: 'eden-shaw' },
      { location: '云阶果园', action: '去包装棚询问夜间分拣工作', characterId: 'nessa-rill' },
    ],
  },
  {
    locale: 'en', cartridge: wanderlightEn,
    encounters: [
      { location: 'Windglass Cliffs', action: 'Ask at the signal tower about tonight’s wind', characterId: 'iona-calder' },
      { location: 'Reedwater Crossing', action: 'Ask by the lock gate when the ferry leaves', characterId: 'luc-maren' },
      { location: 'Whitecap Baths', action: 'Ask about a shift at the public baths', characterId: 'noor-bell' },
      { location: 'Old Quarry Gardens', action: 'Follow the sound of stonework into the terraces', characterId: 'eden-shaw' },
      { location: 'Cloudstep Orchard', action: 'Ask about night sorting work at the packing shed', characterId: 'nessa-rill' },
    ],
  },
]

assert.equal(wanderlight.initialMap.length, 12, '中文地图应扩展为 12 个稳定节点')
assert.equal(wanderlightEn.initialMap.length, 12, '英文地图应扩展为 12 个稳定节点')
assert.deepEqual(wanderlight.initialMap.map((node) => node.id), wanderlightEn.initialMap.map((node) => node.id), '双语地图 ID 与顺序必须一致')
assert.equal(wanderlight.characters.length, 8, '中文预设角色应扩展为 8 名')
assert.equal(wanderlightEn.characters.length, 8, '英文预设角色应扩展为 8 名')
assert.deepEqual(wanderlight.characters.map((character) => character.id), wanderlightEn.characters.map((character) => character.id), '双语角色 ID 与顺序必须一致')

const preExpansionSave = createInitialSave(wanderlight)
preExpansionSave.map = preExpansionSave.map.filter((node) => !expandedLocations.includes(node.id))
const legacyQuay = preExpansionSave.map.find((node) => node.id === 'lantern-quay')
if (legacyQuay?.facts) legacyQuay.facts = legacyQuay.facts.slice(0, 3)
delete preExpansionSave.facts.world_expansion_v2
const migratedOnce = mergeAuthoredMapNodes(preExpansionSave.map, wanderlight)
const migratedTwice = mergeAuthoredMapNodes(migratedOnce, wanderlight)
assert.equal(migratedOnce.length, 12, '旧 7 节点存档必须补入 5 个新增地点')
assert.equal(new Set(migratedOnce.map((node) => node.id)).size, 12, '旧存档迁移不能生成重复地图 ID')
assert.deepEqual(migratedTwice, migratedOnce, '新增地图迁移必须幂等')
assert.ok(migratedOnce.filter((node) => expandedLocations.includes(node.id)).every((node) => !node.current && !node.visited), '旧存档补入的新地点必须保持未访问')
assert.ok(migratedOnce.find((node) => node.id === 'lantern-quay')?.facts?.some((fact) => fact.includes('风玻璃崖')), '旧地点也必须补入发现新增路线的作者事实')

for (const testCase of cases) {
  const { cartridge } = testCase
  const initial = createInitialSave(cartridge)
  assert.ok(initial.facts.world_expansion_v2, `${testCase.locale}: 新存档必须标记世界扩展版本`)
  assert.ok(cartridge.dangerDirector && cartridge.dangerDirector.threatPalette.length >= 10, `${testCase.locale}: 危险池必须覆盖新增地区`)
  assert.ok(cartridge.director && cartridge.director.generationRules.length >= 9, `${testCase.locale}: 导演必须包含地区轮换与跨区线索规则`)

  const hiddenNames = expandedCharacters.map((id) => cartridge.characters.find((character) => character.id === id)?.name ?? '')
  for (const id of expandedCharacters) {
    const definition = cartridge.characters.find((character) => character.id === id)
    assert.ok(definition?.hiddenUntilIntroduced, `${testCase.locale}: ${id} 必须在可见登场前隐藏`)
    assert.ok(definition?.visualIdentity?.appearance && definition.visualIdentity.immutableTraits.length >= 4, `${testCase.locale}: ${id} 必须有完整预设视觉身份`)
    assert.ok(!initial.characters.some((character) => character.id === id), `${testCase.locale}: ${id} 不能预载进人物面板`)
  }
  const playerVisibleOpeningAndMap = JSON.stringify({ opening: cartridge.opening, map: cartridge.initialMap })
  for (const name of hiddenNames) assert.ok(!playerVisibleOpeningAndMap.includes(name), `${testCase.locale}: 隐藏角色 ${name} 不能提前出现在开场或地图文案`)

  for (const nodeId of expandedLocations) {
    const node = cartridge.initialMap.find((candidate) => candidate.id === nodeId)
    assert.ok(node, `${testCase.locale}: 缺少新增地图节点 ${nodeId}`)
    assert.ok((node?.facts?.length ?? 0) >= 4, `${testCase.locale}: ${nodeId} 必须具备工作、社交、环境与跨区事件事实`)
    assert.ok((node?.routeHints?.length ?? 0) >= 6, `${testCase.locale}: ${nodeId} 必须覆盖具体子地点路由词`)
    assert.ok(node?.capabilities?.includes('local-shift') && node.capabilities.includes('public-rest'), `${testCase.locale}: ${nodeId} 必须可工作且可安全恢复`)
    const travel = cartridge.domainRules?.rules.find((rule) => rule.id === `travel-${nodeId}`)
    assert.ok(travel, `${testCase.locale}: ${nodeId} 必须有确定性旅行事务`)
    assert.equal(travel?.successContinuation, 'replace', `${testCase.locale}: 首次抵达 ${nodeId} 应直接安装地区特有入口`)
    assert.equal(travel?.successChoices.length, 3, `${testCase.locale}: ${nodeId} 应提供三个真实地区入口而非通用菜单`)
  }

  for (const encounter of testCase.encounters) {
    const base = createInitialSave(cartridge)
    base.location = encounter.location
    base.sceneLocation = encounter.location
    base.choices = [{ id: 'arrival-0', label: encounter.action }]
    const authored = resolveDeterministicChoiceTurn(base, cartridge, encounter.action)
    assert.ok(authored, `${testCase.locale}: ${encounter.action} 必须有作者级首次登场`)
    const parsed = parseStoryProtocol(authored!.content, testCase.locale)
    assert.deepEqual(validateCharacterContinuity(base, parsed, cartridge), [], `${testCase.locale}: ${encounter.characterId} 的登场顺序必须合法`)
    const introduced = applyParsedScene(base, parsed, cartridge, encounter.action)
    assert.ok(introduced.characters.some((character) => character.id === encounter.characterId), `${testCase.locale}: ${encounter.characterId} 登场后必须进入权威人物存档`)

    const knownBase = { ...base, characters: introduced.characters, choices: [{ id: 'return-0', label: encounter.action }] }
    const reunion = resolveDeterministicChoiceTurn(knownBase, cartridge, encounter.action)
    assert.ok(reunion && reunion.content !== authored!.content, `${testCase.locale}: ${encounter.characterId} 重访必须使用重逢内容而非重复首次登场`)
  }

  const funded = createInitialSave(cartridge)
  funded.stats = { ...funded.stats, coin: 50, energy: 80 }
  for (const encounter of testCase.encounters) {
    const node = cartridge.initialMap.find((candidate) => candidate.label === encounter.location)!
    const rule = cartridge.domainRules?.rules.find((candidate) => candidate.id === `travel-${node.id}`)!
    const resolution = resolveDomainAction(funded, cartridge, rule.intent)
    assert.equal(resolution?.status, 'accepted', `${testCase.locale}: 有钱有精力时必须能前往 ${encounter.location}`)
    assert.ok(resolution?.successChoices.includes(encounter.action), `${testCase.locale}: 抵达 ${encounter.location} 后必须能直接选择预设人物入口`)
    const arrived = applyParsedScene(funded, parseStoryProtocol('', testCase.locale), cartridge, rule.intent, undefined, undefined, undefined, resolution)
    assert.equal(arrived.location, encounter.location, `${testCase.locale}: 旅行事务必须提交 ${encounter.location} 地图节点`)
    assert.equal(arrived.choices.length, 3, `${testCase.locale}: ${encounter.location} 的三个地区入口通过 reducer 后不能被误删`)
    assert.ok(arrived.choices.some((choice) => choice.label === encounter.action), `${testCase.locale}: reducer 过滤后仍须保留 ${encounter.location} 的人物入口`)
  }
}

console.log('wanderlight world expansion: ok')
