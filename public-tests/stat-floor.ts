import { listCartridges } from '../src/story/cartridges/index'
import { resolveDomainAction, statFloorChoices } from '../src/story/engine/domainRules'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const cartridge = listCartridges('zh')[0]
const exhausted = createInitialSave(cartridge)
exhausted.stats.energy = 0

const blocked = resolveDomainAction(exhausted, cartridge, '跟林凯一起深入夜市探听更多消息')
equal(blocked?.status, 'rejected', 'an ungoverned action is blocked at the stat floor')
equal(blocked?.ruleId, 'stat-floor-energy', 'the energy floor owns the rejected turn')
equal(blocked?.successChoices.length, 3, 'the floor installs three recovery choices')
equal(statFloorChoices(exhausted, cartridge)?.[0]?.label, '原地坐下，休息四十五分钟', 'an exhausted restored save derives the same safe tray')

const recovery = resolveDomainAction(exhausted, cartridge, '原地坐下，休息四十五分钟')
equal(recovery?.status, 'accepted', 'an allowed recovery remains executable at zero')
equal(recovery?.ruleId, 'catch-breath', 'the deterministic recovery rule owns the turn')
const recovered = applyParsedScene(exhausted, parseStoryProtocol(recovery!.successText, 'zh'), cartridge, '原地坐下，休息四十五分钟', undefined, undefined, undefined, recovery)
equal(recovered.stats.energy, 8, 'rest restores the exact authored amount')
ok(!recovered.blocks.some((block) => block.data?.statFloor === 'energy' && block.id.includes(`-${recovered.scene}`)), 'leaving the floor does not add a new exhaustion notice')

const nearlyEmpty = createInitialSave(cartridge)
nearlyEmpty.stats.energy = 6
const failed = applyParsedScene(nearlyEmpty, parseStoryProtocol(`你没有成功，原来的麻烦仍然存在。
[widget: energy, remove: 6]
[choices: "继续深入夜市"|"追赶下一班车"|"再接一份短工"]`, 'zh'), cartridge, '继续深入夜市')
equal(failed.stats.energy, 0, 'the loss reaches but does not cross the registered minimum')
ok(failed.blocks.some((block) => block.data?.statFloor === 'energy'), 'crossing the floor adds an immediate in-world explanation')
equal(failed.choices[0]?.label, '原地坐下，休息四十五分钟', 'unsafe model choices are replaced immediately')
equal(failed.choices[2]?.label, '结束今天，休息到清晨', 'a full-stop recovery is always available')

console.log(JSON.stringify({ ok: true, checks: ['zero-block', 'allowed-recovery', 'exact-restoration', 'immediate-floor-explanation', 'recovery-choice-replacement'] }))
