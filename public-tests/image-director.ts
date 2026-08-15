import { listCartridges } from '../src/story/cartridges/index'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }
function latestImage(save: ReturnType<typeof createInitialSave>) { return [...save.blocks].reverse().find((block) => block.kind === 'image') }

const cartridge = listCartridges('zh')[0]
const initial = createInitialSave(cartridge)
const introduced = applyParsedScene(initial, parseStoryProtocol(`月台边，一个短发成年女人正把发光种荚扫回木箱。货签上写着“媛夕”；媛夕扣好箱盖，表示愿意说明这些种子的来历。
[character_update: character_id="mira-voss" character="媛夕" role="28 岁 · 地方植物研究员"]
[choices: "听媛夕说明"|"查看木箱"]`, 'zh'), cartridge, '帮助收拢种荚')
const importantDialogue = parseStoryProtocol(`媛夕收好记录本，抬眼确认你听懂了她的提醒。
[媛夕] [main] [克制]: "林灯一旦连续熄灭三盏，就不是风。你留在我能看见的地方。"
[character_update: character_id="mira-voss" character="媛夕" role="28 岁 · 地方植物研究员"]
[choices: "答应留在灯下"|"询问三盏灯的含义"|"请媛夕带路"]`, 'zh')
const pictured = applyParsedScene(introduced, importantDialogue, cartridge, '听媛夕说明')
const expressionImage = latestImage(pictured)
equal(expressionImage?.id, 'image-2', 'substantive important-character dialogue guarantees an image')
equal(expressionImage?.data?.reason, 'character-expression', 'important dialogue uses the expression trigger')
equal(expressionImage?.data?.identityCharacterId, 'mira-voss', 'expression image is bound to the speaking character')
equal(expressionImage?.data?.playerVisible, 'false', 'NPC expression image cannot receive the player identity')
ok(String(expressionImage?.data?.prompt ?? '').includes('媛夕'), 'expression prompt names the speaker')
ok(String(expressionImage?.data?.prompt ?? '').includes('medium close-up'), 'expression prompt requests a readable reaction shot')

const environmentProposal = applyParsedScene(introduced, importantDialogue, cartridge, '听媛夕说明', 'empty forest lamps in fog, wide environment-only shot', 'environment')
equal(latestImage(environmentProposal)?.data?.reason, 'character-expression', 'generic AI environment proposal cannot override important dialogue')
ok(!String(latestImage(environmentProposal)?.data?.prompt ?? '').includes('empty forest lamps'), 'overridden environment proposal is not sent to image generation')

const unknownSpeaker = parseStoryProtocol(`[临时守灯人] [main] [平静]: "第三盏灯不是被风吹灭的；有人从林内切断了供油管。"
[dialogue_focus: speaker="临时守灯人" expression="压低声音，目光反复扫向林内，手指攥紧灯钩"]
[choices: "请他指出供油管"|"观察林内动静"|"先退回灯屋"]`, 'zh')
const unknownSpeakerImage = latestImage(applyParsedScene(initial, unknownSpeaker, cartridge, '听守灯人说明'))
equal(unknownSpeakerImage?.data?.reason, 'character-expression', 'important dialogue is pictured even when the speaker is not a core character')
equal(unknownSpeakerImage?.data?.identityCharacterId, undefined, 'an unanchored speaker does not borrow another identity')
ok(String(unknownSpeakerImage?.data?.prompt ?? '').includes('临时守灯人'), 'unanchored important speaker still owns the shot')
ok(String(unknownSpeakerImage?.data?.prompt ?? '').includes('目光反复扫向林内'), 'explicit expression direction reaches the image prompt')

const followedByMinorLine = parseStoryProtocol(`[媛夕] [main] [平静]: "你先听我把这条路线说完，别让潮声盖过第三个路标。"
[路人] [main] [平静]: "借过。"
[character_update: character_id="mira-voss" character="媛夕" role="28 岁 · 地方植物研究员"]
[choices: "听媛夕说明路线"|"查看第三个路标"|"让开道路"]`, 'zh')
equal(latestImage(applyParsedScene(introduced, followedByMinorLine, cartridge, '继续听'))?.data?.identityCharacterId, 'mira-voss', 'a later minor line cannot hide the important speaker')

const shortAdministrativeLine = parseStoryProtocol(`[媛夕] [main] [平静]: "知道了。"
[character_update: character_id="mira-voss" character="媛夕" role="28 岁 · 地方植物研究员"]
[choices: "继续赶路"|"查看地图"|"稍作休息"]`, 'zh')
ok(latestImage(applyParsedScene(introduced, shortAdministrativeLine, cartridge, '点头'))?.data?.reason !== 'character-expression', 'short administrative acknowledgement does not force a portrait')

console.log(JSON.stringify({ ok: true, checks: ['important-dialogue-guaranteed', 'speaker-identity-bound', 'any-speaker-dialogue', 'environment-proposal-overridden', 'minor-line-does-not-mask', 'short-line-not-forced'] }))
