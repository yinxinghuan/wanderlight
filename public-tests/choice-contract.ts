import { listCartridges } from '../src/story/cartridges/index'
import { decodeChoiceRecord, resolveNumberedChoiceInput } from '../src/story/engine/choiceInput'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const cartridge = listCartridges('zh')[0]
const initial = createInitialSave(cartridge)
const parsed = parseStoryProtocol(`码头的公告牌滚动着最新的月线发车时间和临时工作信息。

你现在可以：

- 询问招工点的工作人员具体搬运活信息
- 直接报名参加码头的搬运工作
- 观察周围等待月线的其他乘客

[choices: "观察灯湾码头的薪资变化"|"追查今晚房钱的线索"|"换一种方式处理当前局面"]`, 'zh')

const choiceCommands = parsed.commands.filter((command) => command.type === 'choices')
equal(choiceCommands.length, 2, 'both model choice sets remain available for deterministic precedence')
const authoritative = choiceCommands.at(-1)
ok(authoritative?.type === 'choices', 'visible tail choices become authoritative')
equal(authoritative.choices[0], '询问招工点的工作人员具体搬运活信息', 'visible choice 01 wins')
ok(!parsed.blocks.some((block) => /你现在可以|询问招工点/.test(block.text)), 'duplicate visible list is removed from prose')

const next = applyParsedScene(initial, parsed, cartridge, '寻找码头工作')
const record = next.blocks.find((block) => block.id === `choices-${next.scene}`)
ok(record?.kind === 'choices', 'authoritative choices are recorded in the article')
equal(decodeChoiceRecord(record.text)[0], next.choices[0].label, 'article 01 and action tray 01 share one source')
equal(resolveNumberedChoiceInput('1', next.choices), next.choices[0].label, '1 selects current action 01')
equal(resolveNumberedChoiceInput('02', next.choices), next.choices[1].label, '02 selects current action 02')
equal(resolveNumberedChoiceInput('自己问问乘务员', next.choices), '自己问问乘务员', 'free text remains free text')

console.log(JSON.stringify({ ok: true, checks: ['visible-choice-precedence', 'article-tray-single-source', 'numbered-input', 'free-input'] }))
