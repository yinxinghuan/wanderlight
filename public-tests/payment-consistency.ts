import { listCartridges } from '../src/story/cartridges/index'
import { canonicalizePaymentMetadata, repairKnownPaymentGap, validatePaymentConsistency } from '../src/story/engine/paymentConsistency'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const cartridge = listCartridges('zh')[0]
const initial = createInitialSave(cartridge)

const offered = parseStoryProtocol(`媛夕说：“再帮我把木箱送上车，我付你八枚钱币。”
[job: action="offer" id="mira-seed-crate" label="把种荚木箱送上月线" employer="媛夕" wage="8"]`, 'zh')
equal(validatePaymentConsistency(initial, offered, cartridge).length, 0, '明确报价和合同应一致')
const afterOffer = applyParsedScene(initial, offered, cartridge, '询问报酬')
equal(afterOffer.stats.coin, 6, '只承诺报酬不能入账')
equal(afterOffer.jobs[0]?.status, 'offered', '工作合同必须持久化')

const rewrittenOffer = parseStoryProtocol('媛夕改口说：“再帮我送上车，我付你九枚钱币。”\n[job: action="offer" id="mira-seed-crate" label="改掉的工作" employer="媛夕" wage="9"]', 'zh')
ok(validatePaymentConsistency(afterOffer, rewrittenOffer, cartridge).includes('job.offer_cannot_rewrite_contract'), '已持久的工资不能被后续回应改写')
equal(applyParsedScene(afterOffer, rewrittenOffer, cartridge, '改口').jobs[0]?.wage, 8, 'reducer 必须保留原合同工资')

const settled = parseStoryProtocol(`你把木箱推进车厢。媛夕验完绑带，把八枚钱币递给你。
[job: action="settle" id="mira-seed-crate"]`, 'zh')
equal(validatePaymentConsistency(afterOffer, settled, cartridge).length, 0, '完工金额应与合同一致')
const afterSettlement = applyParsedScene(afterOffer, settled, cartridge, '送上木箱')
equal(afterSettlement.stats.coin, 14, '工资应由 reducer 按合同入账')
equal(afterSettlement.jobs[0]?.status, 'settled', '合同应标记已结算')
equal(afterSettlement.facts.jobs_completed, 1, '完工次数应只增加一次')

const duplicateViolations = validatePaymentConsistency(afterSettlement, settled, cartridge)
ok(duplicateViolations.includes('job.settlement_cannot_repeat'), '已结算合同必须拒绝重复结算')
const afterDuplicateReducer = applyParsedScene(afterSettlement, settled, cartridge, '再次领取')
equal(afterDuplicateReducer.stats.coin, 14, 'reducer 也必须防止重复入账')
equal(afterDuplicateReducer.facts.jobs_completed, 1, '重复请求不能增加完工次数')

const screenshot = parseStoryProtocol('最后一个箱子被封好，短发女人露出满意的笑容，掏出几枚铜板递给你。', 'zh')
const screenshotViolations = validatePaymentConsistency(initial, screenshot, cartridge)
ok(screenshotViolations.includes('payment.completed_payment_requires_exact_amount'), '截图中的“几枚铜板”必须被拒绝')
ok(screenshotViolations.includes('job.completed_work_requires_settlement'), '已付款的完工文案必须有合同结算')

const legacyScreenshot = {
  ...initial,
  blocks: [...initial.blocks,
    { id: 'legacy-1', kind: 'narration' as const, text: '这些种荚马上可以送去冷藏了，谢谢你。' },
    { id: 'legacy-2', kind: 'narration' as const, text: '短发女人露出满意的笑容，掏出几枚铜板递给你。' },
  ],
}
const repairedLegacy = repairKnownPaymentGap(legacyScreenshot, cartridge)
equal(repairedLegacy.stats.coin, 14, '已知截图旧存档应按原路线八枚报酬补账')
equal(repairKnownPaymentGap(repairedLegacy, cartridge).stats.coin, 14, '旧存档补账必须幂等')

const mismatch = parseStoryProtocol('工作完成后，她把六枚钱币递给你。\n[job: action="settle" id="mira-seed-crate"]', 'zh')
ok(validatePaymentConsistency(afterOffer, mismatch, cartridge).includes('job.settlement_amount_must_match_contract'), '正文金额不能与合同不一致')

const purchase = parseStoryProtocol('你支付了三枚钱币买下车票。\n[widget: coin, remove: 3]', 'zh')
equal(validatePaymentConsistency(initial, purchase, cartridge).length, 0, '明确支出和扣款应一致')
equal(applyParsedScene(initial, purchase, cartridge, '买票').stats.coin, 3, '实际消费必须扣账')

const premature = parseStoryProtocol('她说：“再帮我把木箱送上车，我付你八枚钱币。”\n[widget: coin, add: 8]', 'zh')
ok(validatePaymentConsistency(initial, premature, cartridge).includes('payment.promise_must_not_credit_coin'), '只承诺付款时不能提前入账')
const canonicalOffer = canonicalizePaymentMetadata(initial, parseStoryProtocol('莉莎说：“搬完这些货物后，我付你八枚钱币。”', 'zh'), cartridge, '答应帮莉莎搬运货物')
equal(validatePaymentConsistency(initial, canonicalOffer, cartridge).length, 0, '明确报价缺少协议时应本地建立合同')
equal(applyParsedScene(initial, canonicalOffer, cartridge, '答应帮莉莎搬运货物').stats.coin, 6, '本地补合同不能提前发钱')

const canonicalPaidWork = canonicalizePaymentMetadata(initial, parseStoryProtocol('你搬完最后一只箱子，莉莎把八枚钱币递给你。', 'zh'), cartridge, '帮莉莎搬运货物')
equal(validatePaymentConsistency(initial, canonicalPaidWork, cartridge).length, 0, '明确完工付款缺少协议时应补齐即时合同与结算')
equal(applyParsedScene(initial, canonicalPaidWork, cartridge, '帮莉莎搬运货物').stats.coin, 14, '本地结算必须按可见精确金额入账')

const canonicalPurchase = canonicalizePaymentMetadata(initial, parseStoryProtocol('你支付了三枚钱币买下车票。', 'zh'), cartridge, '买票')
equal(validatePaymentConsistency(initial, canonicalPurchase, cartridge).length, 0, '明确消费缺少协议时应补齐扣款')
equal(applyParsedScene(initial, canonicalPurchase, cartridge, '买票').stats.coin, 3, '本地消费补齐必须扣除精确金额')

const doubled = parseStoryProtocol(`你完成装箱，她把九枚钱币递给你。
[job: action="offer" id="instant-packing" label="完成装箱" employer="码头雇主" wage="9"]
[job: action="settle" id="instant-packing"]
[widget: coin, add: 9]`, 'zh')
ok(validatePaymentConsistency(initial, doubled, cartridge).includes('job.settlement_must_not_duplicate_widget_credit'), '合同结算不能叠加 widget')
equal(applyParsedScene(initial, doubled, cartridge, '完成装箱').stats.coin, 15, 'reducer 防御必须避免双倍入账')
const canonicalDoubled = canonicalizePaymentMetadata(initial, doubled, cartridge, '完成装箱')
equal(validatePaymentConsistency(initial, canonicalDoubled, cartridge).length, 0, '本地规范化应移除合同结算旁的重复钱币指令')
equal(applyParsedScene(initial, canonicalDoubled, cartridge, '完成装箱').stats.coin, 15, '移除重复指令后工资仍只入账一次')

console.log(JSON.stringify({ ok: true, checks: ['offer-no-credit', 'contract-immutable', 'contract-settlement', 'repeat-rejected', 'screenshot-vague-payment', 'legacy-screenshot-repair', 'amount-mismatch', 'purchase', 'promise-no-credit', 'offer-canonicalized', 'paid-work-canonicalized', 'purchase-canonicalized', 'no-double-credit', 'duplicate-credit-canonicalized'] }))
