import { strict as assert } from 'node:assert'
import { wanderlight, wanderlightEn } from '../src/story/cartridges/wanderlight'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave, normalizeCharacterState, updateCharacterVisualIdentity } from '../src/story/engine/reducer'
import { prepareTurnCandidate } from '../src/story/engine/turnPipeline'

function prepared(content: string, locale: 'zh' | 'en', save = createInitialSave(locale === 'zh' ? wanderlight : wanderlightEn)) {
  const cartridge = locale === 'zh' ? wanderlight : wanderlightEn
  return prepareTurnCandidate({ save, parsed: parseStoryProtocol(content, locale), cartridge, action: locale === 'zh' ? '和新认识的人交谈' : 'Talk to the person I just met' })
}

const validZh = `雨棚下，一个戴绿铜胸针的成年女人正扶起倒下的路牌。摊主喊她“伊莱拉”；她回头说明自己熟悉旧桥，也愿意和你一起去确认潮位。
[伊莱拉] [main] [坦率]: "旧桥还能走，但我们得在涨潮前回来。"
[character_update: character_id="elara-venn" character="伊莱拉" role="30 岁 · 旧桥向导" detail="在雨棚下扶起路牌" lore="熟悉旧桥潮汐" vitality="82" stress="18" skills="识路: 4" visual_appearance="One adult woman age 30, short black curls, green copper brooch, ochre raincoat" visual_traits="age 30|short black curls|green copper brooch" visual_wardrobe="ochre raincoat" visual_forbidden="age drift|hair drift|missing brooch"]
[party_change: character_id="elara-venn" character="伊莱拉" change="add"]
[reputation: npc="伊莱拉" action="trusted"]
[choices: "和伊莱拉去旧桥"|"先问清涨潮时间"]`

let save = createInitialSave(wanderlight)
const validCandidate = prepared(validZh, 'zh', save)
assert.deepEqual(validCandidate.violations, [], 'a visible generated debut should pass the turn boundary')
save = applyParsedScene(save, validCandidate.parsed, wanderlight, '和新认识的人交谈')
let generated = save.characters.find((character) => character.id === 'elara-venn')
assert.ok(generated, 'generated character should be stored')
assert.equal(generated.origin, 'generated')
assert.equal(generated.status, 'companion')
assert.equal(generated.visualIdentity?.status, 'queued')
assert.equal(generated.visualIdentity?.source, 'generated')
assert.equal(save.relationships.at(-1)?.characterId, 'elara-venn')
assert.ok(save.partyMemberIds.includes('elara-venn'))
assert.equal([...save.blocks].reverse().find((block) => block.kind === 'image')?.data?.identityCharacterId, 'elara-venn', 'first important dialogue image should bind the generated identity')

save = updateCharacterVisualIdentity(save, 'elara-venn', { status: 'anchored', anchorTaskId: 'qa-anchor-task-001' })
const restoredState = normalizeCharacterState(JSON.parse(JSON.stringify(save)), wanderlight)
generated = restoredState.characters.find((character) => character.id === 'elara-venn')
assert.equal(generated?.visualIdentity?.anchorTaskId, 'qa-anchor-task-001', 'anchor task id should survive save serialization and normalization')
assert.equal(generated?.visualIdentity?.status, 'anchored')
assert.equal(generated?.status, 'companion')
assert.ok(restoredState.partyMemberIds.includes('elara-venn'))
assert.equal(restoredState.relationships.at(-1)?.characterId, 'elara-venn')

const followup = parseStoryProtocol(`[伊莱拉] [main] [警觉]: "潮水提前了。跟紧我。"
[dialogue_focus: speaker="伊莱拉" expression="望向桥墩，握紧胸针"]
[choices: "跟紧伊莱拉"|"退回雨棚"]`, 'zh')
const afterReload = applyParsedScene({ ...save, ...restoredState }, followup, wanderlight, '继续前往旧桥')
assert.equal([...afterReload.blocks].reverse().find((block) => block.kind === 'image')?.data?.identityCharacterId, 'elara-venn', 'later expression image should reuse the restored stable identity')

const silentProtocol = `雨棚外只有雨声，路上没有出现任何人。
[character_update: character_id="silent-stranger" character="未露面的陌生人" role="29 岁 · 向导" visual_appearance="One adult guide" visual_traits="adult"]
[choices: "继续听雨"]`
const silentCandidate = prepared(silentProtocol, 'zh')
assert.ok(silentCandidate.violations.includes('character.new_character_requires_visible_debut'))
const silentReduced = applyParsedScene(createInitialSave(wanderlight), silentCandidate.parsed, wanderlight, '听雨')
assert.ok(!silentReduced.characters.some((character) => character.id === 'silent-stranger'), 'reducer must reject a protocol-only character even when validation is bypassed')

const missingId = `路边一个修伞人正在收拢伞骨。柜台标签写着“岚舟”；岚舟说可以帮你补伞。
[character_update: character="岚舟" role="32 岁 · 修伞人" visual_appearance="One adult umbrella repairer" visual_traits="adult"]
[choices: "请岚舟补伞"]`
assert.ok(prepared(missingId, 'zh').violations.includes('character.new_character_requires_stable_id'))
assert.ok(!applyParsedScene(createInitialSave(wanderlight), parseStoryProtocol(missingId, 'zh'), wanderlight, '补伞').characters.some((character) => character.name === '岚舟'))

const missingVisualIdentity = `桥边一个成年男人正在重新系紧缆绳。木牌写着“沈岸”；沈岸说愿意带你过桥。
[character_update: character_id="shen-an" character="沈岸" role="34 岁 · 摆渡人"]
[choices: "请沈岸带路"]`
assert.ok(prepared(missingVisualIdentity, 'zh').violations.includes('character.generated_character_requires_visual_identity'))
assert.ok(!applyParsedScene(createInitialSave(wanderlight), parseStoryProtocol(missingVisualIdentity, 'zh'), wanderlight, '过桥').characters.some((character) => character.id === 'shen-an'))

const renameAttack = `远处另一个男人自称诺兰。
[character_update: character_id="elara-venn" character="诺兰" role="45 岁 · 商人"]
[choices: "和诺兰交谈"]`
const renameCandidate = prepared(renameAttack, 'zh', save)
assert.ok(renameCandidate.violations.includes('character.id_cannot_change_identity'))
const renameReduced = applyParsedScene(save, renameCandidate.parsed, wanderlight, '观察远处的人')
assert.equal(renameReduced.characters.find((character) => character.id === 'elara-venn')?.name, '伊莱拉', 'stable id cannot be renamed')
assert.equal(renameReduced.characters.find((character) => character.id === 'elara-venn')?.visualIdentity?.anchorTaskId, 'qa-anchor-task-001')

const aliasIdAttack = `伊莱拉仍站在旧桥边，提醒你潮水正在上涨。
[character_update: character_id="other-elara" character="伊莱拉" role="30 岁 · 旧桥向导" visual_appearance="Different person" visual_traits="different face"]
[choices: "听伊莱拉说明"]`
assert.ok(prepared(aliasIdAttack, 'zh', save).violations.includes('character.id_cannot_change_identity'))
assert.ok(!applyParsedScene(save, parseStoryProtocol(aliasIdAttack, 'zh'), wanderlight, '听说明').characters.some((character) => character.id === 'other-elara'))

const unknownReferences = `你独自在雨里等了一会儿。
[party_change: character_id="unknown-guide" character="陌生向导" change="add"]
[reputation: npc="陌生向导" action="trusted"]
[choices: "继续等待"]`
const unknownCandidate = prepared(unknownReferences, 'zh')
assert.ok(unknownCandidate.violations.includes('party.character_must_be_known'))
assert.ok(unknownCandidate.violations.includes('relationship.character_must_be_known'))
const unknownReduced = applyParsedScene(createInitialSave(wanderlight), unknownCandidate.parsed, wanderlight, '等待')
assert.ok(!unknownReduced.characters.some((character) => character.id === 'unknown-guide'))
assert.equal(unknownReduced.relationships.length, 0)

const invisibleJoin = `伊莱拉检查完胸针，提醒你旧桥很滑。
[party_change: character_id="elara-venn" character="伊莱拉" change="add"]
[choices: "自己去旧桥"]`
const knownWithoutParty = { ...save, partyMemberIds: [], characters: save.characters.map((character) => character.id === 'elara-venn' ? { ...character, status: 'known' as const } : character) }
assert.ok(prepared(invisibleJoin, 'zh', knownWithoutParty).violations.includes('party.join_must_be_visible'))
assert.ok(!applyParsedScene(knownWithoutParty, parseStoryProtocol(invisibleJoin, 'zh'), wanderlight, '自己去旧桥').partyMemberIds.includes('elara-venn'))

const validEn = `Beside the signal box, an adult mechanic tightens a loose brass hinge. The shift card reads “Nora Vale.” Nora Vale looks up and offers to guide you through the service tunnel.
[Nora Vale] [main] [steady]: "Stay beside the blue cable and we will reach the other platform together."
[character_update: character_id="nora-vale" character="Nora Vale" role="Age 33 · signal mechanic" visual_appearance="One adult woman age 33, dark curls, blue work coat, brass calipers" visual_traits="age 33|dark curls|brass calipers" visual_wardrobe="blue work coat" visual_forbidden="age drift|hair drift"]
[party_change: character_id="nora-vale" character="Nora Vale" change="add"]
[reputation: npc="Nora Vale" action="trusted"]
[choices: "Follow Nora Vale through the service tunnel"|"Ask about the blue cable"]`
const enCandidate = prepared(validEn, 'en')
assert.deepEqual(enCandidate.violations, [])
const enSave = applyParsedScene(createInitialSave(wanderlightEn), enCandidate.parsed, wanderlightEn, 'Talk to the person I just met')
assert.equal(enSave.characters.find((character) => character.id === 'nora-vale')?.origin, 'generated')
assert.ok(enSave.partyMemberIds.includes('nora-vale'))
assert.equal(enSave.relationships.at(-1)?.characterId, 'nora-vale')

console.log(JSON.stringify({
  ok: true,
  assertions: 39,
  coverage: ['visible-debut', 'stable-id', 'visual-identity-required', 'party-and-relationship-binding', 'anchor-task-reload', 'later-image-reuse', 'protocol-only-rejection', 'id-rename-rejection', 'name-id-collision', 'unknown-reference-rejection', 'visible-join', 'zh-en'],
}))
