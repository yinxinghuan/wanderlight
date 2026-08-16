import { listCartridges } from '../src/story/cartridges/index'
import { actionAuthorizesCoinSpend, canonicalizePaymentMetadata, repairKnownPaymentGap, repairKnownUnauthorizedLodgingPayment, repairUnsettledContractPayment, validatePaymentConsistency } from '../src/story/engine/paymentConsistency'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const cartridge = listCartridges('zh')[0]
const initial = createInitialSave(cartridge)
const englishCartridge = listCartridges('en')[0]
const englishInitial = createInitialSave(englishCartridge)
const englishOffer = parseStoryProtocol('The supervisor says the completed packing work will pay you 8 coins.\n[job: action="offer" id="english-crates" label="Pack three cases" employer="Supervisor" wage="8"]', 'en')
equal(validatePaymentConsistency(englishInitial, englishOffer, englishCartridge).length, 0, 'English future-tense wage offer must remain a promise, not a completed receipt')
equal(applyParsedScene(englishInitial, englishOffer, englishCartridge, 'Ask about packing work').stats.coin, 6, 'English future-tense wage offer cannot pay early')
const englishAfterOffer = applyParsedScene(englishInitial, englishOffer, englishCartridge, 'Ask about packing work')

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

const englishCountsOut = canonicalizePaymentMetadata(englishInitial, parseStoryProtocol(`Together you carry all three wooden cases across the wet aisle and set them on the dry platform. When the last case is secure, Celeste counts out 7 coin on the spot.
[widget: coin, add: 7]`, 'en'), englishCartridge, 'Help move cases at the night market')
equal(validatePaymentConsistency(englishInitial, englishCountsOut, englishCartridge, 'Help move cases at the night market').length, 0, 'English counts-out wages must be recognized as a visible completed payment')
equal(applyParsedScene(englishInitial, englishCountsOut, englishCartridge, 'Help move cases at the night market').stats.coin, 13, 'English counts-out wages must settle exactly once')

const screenshot = parseStoryProtocol('最后一个箱子被封好，短发女人露出满意的笑容，掏出几枚铜板递给你。', 'zh')
const screenshotViolations = validatePaymentConsistency(initial, screenshot, cartridge)
ok(screenshotViolations.includes('payment.completed_payment_requires_exact_amount'), '截图中的“几枚铜板”必须被拒绝')
ok(screenshotViolations.includes('job.completed_work_requires_settlement'), '已付款的完工文案必须有合同结算')
const copperCoinScreenshot = parseStoryProtocol('整理工作完成后，她把装着几枚铜币的小布袋递给你，说这是你的报酬。', 'zh')
const copperCoinViolations = validatePaymentConsistency(initial, copperCoinScreenshot, cartridge)
ok(copperCoinViolations.includes('payment.completed_payment_requires_exact_amount'), '“几枚铜币”同样必须被识别并拒绝模糊入账')
ok(copperCoinViolations.includes('job.completed_work_requires_settlement'), '铜币付款不能绕过工作结算')

const vagueCompensationScreenshot = parseStoryProtocol(`这份体力活让你感到疲惫，但也赚得了些急需的报酬。

搬运结束，招工负责人走过来，递给你们报酬。`, 'zh')
const vagueCompensationViolations = validatePaymentConsistency(initial, vagueCompensationScreenshot, cartridge, '帮媛夕把木箱送上货船')
ok(vagueCompensationViolations.includes('payment.completed_payment_requires_exact_amount'), '“赚得了些报酬”不能绕过精确金额校验')
ok(vagueCompensationViolations.includes('job.completed_work_requires_settlement'), '“递给你们报酬”必须触发工作结算校验')

const vagueWageEnglish = parseStoryProtocol('The cargo shift ends. You earned some pay, and the foreman hands you the wages.', 'en')
const vagueWageEnglishViolations = validatePaymentConsistency(englishInitial, vagueWageEnglish, englishCartridge, 'Help load the cargo')
ok(vagueWageEnglishViolations.includes('payment.completed_payment_requires_exact_amount'), 'English vague wages must require an exact visible amount')
ok(vagueWageEnglishViolations.includes('job.completed_work_requires_settlement'), 'English vague wages must require job settlement')
for (const phrase of ['你收到了今天的薪水。', '工头把工资交给你。', '你的工钱已经到账。', '负责人给你发了报酬。']) {
  ok(validatePaymentConsistency(initial, parseStoryProtocol(phrase, 'zh'), cartridge).includes('payment.completed_payment_requires_exact_amount'), `中文收入同义词必须要求精确金额: ${phrase}`)
}
for (const phrase of ['You received your salary.', 'You got paid for the shift.', 'The foreman hands you the wages.', 'Your compensation was settled.']) {
  ok(validatePaymentConsistency(englishInitial, parseStoryProtocol(phrase, 'en'), englishCartridge).includes('payment.completed_payment_requires_exact_amount'), `English income synonym must require an exact amount: ${phrase}`)
}
const exactSalary = canonicalizePaymentMetadata(initial, parseStoryProtocol('装货结束后，你收到了八枚钱币的工资。', 'zh'), cartridge, '完成装货')
equal(validatePaymentConsistency(initial, exactSalary, cartridge, '完成装货').length, 0, '精确工资同义词应建立并结算工作合同')
equal(applyParsedScene(initial, exactSalary, cartridge, '完成装货').stats.coin, 14, '精确工资同义词必须实际入账')
const exactEnglishSalary = canonicalizePaymentMetadata(englishInitial, parseStoryProtocol('After the shift, you received 8 coin as salary.', 'en'), englishCartridge, 'Finish the shift')
equal(validatePaymentConsistency(englishInitial, exactEnglishSalary, englishCartridge, 'Finish the shift').length, 0, 'Exact English salary should create and settle a job contract')
equal(applyParsedScene(englishInitial, exactEnglishSalary, englishCartridge, 'Finish the shift').stats.coin, 14, 'Exact English salary must credit coin')
equal(validatePaymentConsistency(initial, parseStoryProtocol('媛夕领到了她自己的工钱，你没有参与这份工作。', 'zh'), cartridge).length, 0, 'NPC 自己领工资不能误记成玩家收入')
equal(validatePaymentConsistency(englishInitial, parseStoryProtocol('Celeste earned her pay. You only watched the stage.', 'en'), englishCartridge).length, 0, 'NPC English wages cannot be mistaken for player income')
equal(validatePaymentConsistency(initial, parseStoryProtocol('询问不会替你接受工作，也不会提前获得报酬。', 'zh'), cartridge).length, 0, '明确否定的收入不能误判成已收款')
equal(validatePaymentConsistency(englishInitial, parseStoryProtocol('Asking does not accept the job, and you will not receive wages yet.', 'en'), englishCartridge).length, 0, 'English denied wages cannot be mistaken for receipt')
equal(validatePaymentConsistency(englishInitial, parseStoryProtocol('No shift or payment is committed until you take and finish the work.', 'en'), englishCartridge).length, 0, 'The letters “if” inside “shift” cannot create a false payment promise')
const futureWageZh = canonicalizePaymentMetadata(afterOffer, parseStoryProtocol('你和负责人确认了封装顺序；下一步是装好三只木箱并领取工钱，八枚钱币仍要等全部装好后结算。', 'zh'), cartridge, '确认封装顺序')
equal(futureWageZh.commands.some((command) => command.type === 'job' && command.action === 'settle'), false, '未来领取工资的计划不能被误判为已经结算')
equal(applyParsedScene(afterOffer, futureWageZh, cartridge, '确认封装顺序').stats.coin, 6, '未来工资不能提前增加钱币')
const futureWageEn = canonicalizePaymentMetadata(englishInitial, parseStoryProtocol('The next step is to finish the cases and collect the wage; five coins remain due only after completion.', 'en'), englishCartridge, 'Confirm the packing order')
equal(futureWageEn.commands.some((command) => command.type === 'job' && command.action === 'settle'), false, 'English future wage plan cannot settle a contract early')
equal(applyParsedScene(englishInitial, futureWageEn, englishCartridge, 'Confirm the packing order').stats.coin, 6, 'English future wage cannot credit coins early')

for (const phrase of [
  '你准备领取八枚钱币的工钱，但负责人还没有验收。',
  '你打算明早领取八枚钱币的工资。',
  '你可以在验收后领取八枚钱币的报酬。',
  '负责人稍后会把八枚钱币递给你。',
  '负责人正准备把八枚钱币交给你。',
  '八枚钱币将由负责人在明早支付给你。',
]) {
  const candidate = canonicalizePaymentMetadata(afterOffer, parseStoryProtocol(phrase, 'zh'), cartridge, '确认结算时间')
  equal(candidate.commands.some((command) => command.type === 'job' && command.action === 'settle'), false, `未发生的中文工资不能提前结算: ${phrase}`)
  equal(applyParsedScene(afterOffer, candidate, cartridge, '确认结算时间').stats.coin, 6, `未发生的中文工资不能提前入账: ${phrase}`)
}

for (const phrase of [
  'The supervisor plans to hand you 8 coins as wages tomorrow.',
  'The supervisor will hand you 8 coins as wages after inspection.',
  'You are about to receive 8 coins as salary.',
  'The supervisor says she pays you 8 coins tomorrow.',
  'She hands you 8 coins tomorrow after the ledger closes.',
]) {
  const candidate = canonicalizePaymentMetadata(englishAfterOffer, parseStoryProtocol(phrase, 'en'), englishCartridge, 'Confirm the settlement time')
  equal(candidate.commands.some((command) => command.type === 'job' && command.action === 'settle'), false, `English scheduled wage cannot settle early: ${phrase}`)
  equal(applyParsedScene(englishAfterOffer, candidate, englishCartridge, 'Confirm the settlement time').stats.coin, 6, `English scheduled wage cannot credit early: ${phrase}`)
}

for (const phrase of [
  '负责人验收完木箱，当场把八枚钱币递给你作为工钱。',
  '你的工资已经到账，一共八枚钱币。',
  '你领到了八枚钱币的报酬。',
]) {
  const candidate = canonicalizePaymentMetadata(afterOffer, parseStoryProtocol(phrase, 'zh'), cartridge, '完成装箱')
  equal(applyParsedScene(afterOffer, candidate, cartridge, '完成装箱').stats.coin, 14, `已经发生的中文工资必须入账: ${phrase}`)
}

for (const phrase of [
  'After inspecting the cases, the supervisor hands you 8 coins as wages.',
  'You received 8 coins as salary for the completed shift.',
  'The supervisor paid you 8 coins for the finished packing work.',
]) {
  const candidate = canonicalizePaymentMetadata(englishAfterOffer, parseStoryProtocol(phrase, 'en'), englishCartridge, 'Finish packing')
  equal(applyParsedScene(englishAfterOffer, candidate, englishCartridge, 'Finish packing').stats.coin, 14, `Completed English wage must credit: ${phrase}`)
}

let scheduledWageVariants = 0
for (const cue of ['准备', '打算', '计划', '正要', '即将', '稍后会', '明早会']) {
  for (const verb of ['领取', '收到', '拿到']) {
    const phrase = `你${cue}${verb}八枚钱币的工资。`
    const candidate = canonicalizePaymentMetadata(afterOffer, parseStoryProtocol(phrase, 'zh'), cartridge, '确认结算时间')
    equal(candidate.commands.some((command) => command.type === 'job' && command.action === 'settle'), false, `中文未来工资组合不能提前结算: ${phrase}`)
    scheduledWageVariants += 1
  }
  for (const verb of ['递给', '交给', '支付给']) {
    const phrase = `负责人${cue}把八枚钱币${verb}你作为工资。`
    const candidate = canonicalizePaymentMetadata(afterOffer, parseStoryProtocol(phrase, 'zh'), cartridge, '确认结算时间')
    equal(candidate.commands.some((command) => command.type === 'job' && command.action === 'settle'), false, `中文未来转账组合不能提前结算: ${phrase}`)
    scheduledWageVariants += 1
  }
}
for (const cue of ['plans to', 'intends to', 'will', 'is about to', 'is scheduled to']) {
  for (const verb of ['hand', 'give', 'pay']) {
    const phrase = `The supervisor ${cue} ${verb} you 8 coins as wages.`
    const candidate = canonicalizePaymentMetadata(englishAfterOffer, parseStoryProtocol(phrase, 'en'), englishCartridge, 'Confirm settlement timing')
    equal(candidate.commands.some((command) => command.type === 'job' && command.action === 'settle'), false, `English future wage combination cannot settle early: ${phrase}`)
    scheduledWageVariants += 1
  }
}

for (const action of [
  '询问房费', '看看房间价格', '寻找便宜住宿', '考虑是否住下', '打听一晚多少钱',
]) {
  const candidate = canonicalizePaymentMetadata(initial, parseStoryProtocol('你支付了十枚钱币订下房间。', 'zh'), cartridge, action)
  ok(validatePaymentConsistency(initial, candidate, cartridge, action).includes('payment.purchase_requires_player_authorization'), `中文询价不能授权模型付款: ${action}`)
}
for (const action of [
  'Ask the room price', 'Check the cost of a room', 'Look for affordable lodging', 'Consider staying overnight', 'Find out how much one night costs',
]) {
  const candidate = canonicalizePaymentMetadata(englishInitial, parseStoryProtocol('You paid 10 coins and booked the room.', 'en'), englishCartridge, action)
  ok(validatePaymentConsistency(englishInitial, candidate, englishCartridge, action).includes('payment.purchase_requires_player_authorization'), `English inquiry cannot authorize model spending: ${action}`)
}

const savedVaguePayment = {
  ...afterOffer,
  scene: 3,
  blocks: [...afterOffer.blocks,
    { id: 'action-3', kind: 'event' as const, text: '帮媛夕把木箱送上货船' },
    { id: 'vague-pay-3', kind: 'narration' as const, text: '搬运结束，招工负责人走过来，递给你们报酬。' },
  ],
}
const repairedVaguePayment = repairUnsettledContractPayment(savedVaguePayment, cartridge)
equal(repairedVaguePayment.stats.coin, 14, '旧档仅在唯一精确工资合同存在时补回漏掉的报酬')
equal(repairedVaguePayment.jobs[0]?.status, 'settled', '旧档补账后合同必须结清')
equal(repairUnsettledContractPayment(repairedVaguePayment, cartridge).stats.coin, 14, '合同补账必须幂等')
const ambiguousVaguePayment = repairUnsettledContractPayment({
  ...savedVaguePayment,
  jobs: [...savedVaguePayment.jobs, { id: 'other-job', label: '另一份工作', wage: 5, status: 'offered' as const, offeredAtScene: 2 }],
}, cartridge)
equal(ambiguousVaguePayment.stats.coin, 6, '多个未结合同存在时不得猜测该结算哪一份')
const noContractVaguePayment = repairUnsettledContractPayment({ ...savedVaguePayment, jobs: [] }, cartridge)
equal(noContractVaguePayment.stats.coin, 6, '没有精确合同的旧档不得凭“些报酬”猜金额')

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

const nightMarketLegacy = {
  ...initial,
  blocks: [...initial.blocks,
    { id: 'night-market-1', kind: 'narration' as const, text: '调制夜市上独特的风味酱料，卖得很贵。' },
    { id: 'night-market-2', kind: 'narration' as const, text: '整理工作完成后，她从怀里掏出一个小布袋，里面装着几枚铜币，递给你：“这是你的报酬，够你今晚住旅店了。”' },
  ],
}
const repairedNightMarket = repairKnownPaymentGap(nightMarketLegacy, cartridge)
equal(repairedNightMarket.stats.coin, 14, '截图中的夜市酱料报酬应一次性补八枚钱币')
equal(repairedNightMarket.jobs.at(-1)?.id, 'legacy-night-market-sauce-sorting-v1', '夜市补账必须留下稳定结算记录')
equal(repairKnownPaymentGap(repairedNightMarket, cartridge).stats.coin, 14, '夜市补账必须幂等')
const spentAfterNightMarket = repairKnownPaymentGap({ ...nightMarketLegacy, stats: { ...nightMarketLegacy.stats, coin: 2 } }, cartridge)
equal(spentAfterNightMarket.stats.coin, 10, '玩家在坏回合后消费过也必须补回遗漏的八枚报酬')

const mismatch = parseStoryProtocol('工作完成后，她把六枚钱币递给你。\n[job: action="settle" id="mira-seed-crate"]', 'zh')
ok(validatePaymentConsistency(afterOffer, mismatch, cartridge).includes('job.settlement_amount_must_match_contract'), '正文金额不能与合同不一致')

const purchase = parseStoryProtocol('你支付了三枚钱币买下车票。\n[widget: coin, remove: 3]', 'zh')
equal(validatePaymentConsistency(initial, purchase, cartridge, '买票').length, 0, '玩家明确授权后的支出和扣款应一致')
equal(applyParsedScene(initial, purchase, cartridge, '买票').stats.coin, 3, '实际消费必须扣账')
equal(actionAuthorizesCoinSpend('把钱全部花完', 'zh'), false, '只有预算没有购买对象时不能替玩家决定消费')
equal(actionAuthorizesCoinSpend('把所有钱都花掉', 'zh'), false, '泛化消费的另一种词序也不能绕过购买对象')
equal(actionAuthorizesCoinSpend('把钱花在码头旅店的房费上', 'zh'), true, '明确消费对象后才构成授权')
equal(actionAuthorizesCoinSpend('spend all my money', 'en'), false, 'generic English spending intent also requires a purchase object')
equal(actionAuthorizesCoinSpend('spend 3 coin on a train ticket', 'en'), true, 'English spending with an explicit object is authorized')
const genericSpentDraft = parseStoryProtocol('你掏出仅有的六枚钱币，决定全部花掉。\n[widget: coin, remove: 6]', 'zh')
ok(validatePaymentConsistency(initial, genericSpentDraft, cartridge, '把钱全部花完').includes('payment.purchase_requires_player_authorization'), '正文声称泛化消费完成时也必须被事务校验拦截')

const unauthorizedRoom = parseStoryProtocol('你用这枚硬币支付了码头楼上旅店的房费。\n[widget: coin, add: 1]', 'zh')
const unauthorizedRoomViolations = validatePaymentConsistency(initial, unauthorizedRoom, cartridge, '寻找其他交通或住宿方案')
ok(unauthorizedRoomViolations.includes('payment.purchase_requires_player_authorization'), '寻找或询问住宿不等于授权付款')
ok(unauthorizedRoomViolations.includes('payment.purchase_must_not_credit_coin'), '截图里的付款 +1 必须被识别为反向入账')
ok(unauthorizedRoomViolations.includes('payment.purchase_requires_matching_coin_remove'), '付款正文不能缺少对应扣款')

const exploratoryRoom = parseStoryProtocol('旅店老板告诉你，房费是十枚钱币。', 'zh')
equal(validatePaymentConsistency(initial, exploratoryRoom, cartridge, '询问旅店房费').length, 0, '只询价且未发生交易时不应扣款')
const modelInventedRemoval = parseStoryProtocol('旅店老板告诉你还有空房。\n[widget: coin, remove: 10]', 'zh')
ok(validatePaymentConsistency(initial, modelInventedRemoval, cartridge, '询问旅店房费').includes('payment.coin_remove_requires_player_authorization'), '没有付款正文也不能偷偷扣款')
ok(validatePaymentConsistency(initial, modelInventedRemoval, cartridge, '支付房费').includes('payment.coin_remove_requires_visible_purchase'), '即使玩家同意付款，正文也必须显示实际交易')
const modelInventedIncome = parseStoryProtocol('码头上的人群仍在等待通知。\n[widget: coin, add: 1]', 'zh')
ok(validatePaymentConsistency(initial, modelInventedIncome, cartridge, '等待通知').includes('payment.coin_add_requires_visible_receipt'), '没有可见收款时不能凭协议增加钱币')

const premature = parseStoryProtocol('她说：“再帮我把木箱送上车，我付你八枚钱币。”\n[widget: coin, add: 8]', 'zh')
ok(validatePaymentConsistency(initial, premature, cartridge).includes('payment.promise_must_not_credit_coin'), '只承诺付款时不能提前入账')
const canonicalOffer = canonicalizePaymentMetadata(initial, parseStoryProtocol('莉莎说：“搬完这些货物后，我付你八枚钱币。”', 'zh'), cartridge, '答应帮莉莎搬运货物')
equal(validatePaymentConsistency(initial, canonicalOffer, cartridge).length, 0, '明确报价缺少协议时应本地建立合同')
equal(applyParsedScene(initial, canonicalOffer, cartridge, '答应帮莉莎搬运货物').stats.coin, 6, '本地补合同不能提前发钱')

const canonicalPaidWork = canonicalizePaymentMetadata(initial, parseStoryProtocol('你搬完最后一只箱子，莉莎把八枚钱币递给你。', 'zh'), cartridge, '帮莉莎搬运货物')
equal(validatePaymentConsistency(initial, canonicalPaidWork, cartridge).length, 0, '明确完工付款缺少协议时应补齐即时合同与结算')
equal(applyParsedScene(initial, canonicalPaidWork, cartridge, '帮莉莎搬运货物').stats.coin, 14, '本地结算必须按可见精确金额入账')

const canonicalPurchase = canonicalizePaymentMetadata(initial, parseStoryProtocol('你支付了三枚钱币买下车票。', 'zh'), cartridge, '买票')
equal(validatePaymentConsistency(initial, canonicalPurchase, cartridge, '买票').length, 0, '明确消费缺少协议时应补齐扣款')
equal(applyParsedScene(initial, canonicalPurchase, cartridge, '买票').stats.coin, 3, '本地消费补齐必须扣除精确金额')

const canonicalScreenshotDirection = canonicalizePaymentMetadata(initial, unauthorizedRoom, cartridge, '支付房费')
equal(validatePaymentConsistency(initial, canonicalScreenshotDirection, cartridge, '支付房费').length, 0, '已授权的“用这枚硬币支付”必须纠正为扣除一枚')
equal(applyParsedScene(initial, canonicalScreenshotDirection, cartridge, '支付房费').stats.coin, 5, '截图句式明确授权时只能 -1，不能 +1')

const unauthorizedCanonical = canonicalizePaymentMetadata(initial, unauthorizedRoom, cartridge, '寻找住宿')
ok(validatePaymentConsistency(initial, unauthorizedCanonical, cartridge, '寻找住宿').includes('payment.purchase_requires_player_authorization'), '规范化不能替未授权行动补造扣款')

const persistedUnauthorizedRoom = {
  ...initial,
  stats: { ...initial.stats, coin: 7 },
  blocks: [...initial.blocks,
    { id: 'action-1', kind: 'event' as const, text: '询问乘务员取消后的安排' },
    { id: 'bad-room', kind: 'narration' as const, text: '你用这枚硬币支付了码头楼上旅店的房费，确保了今晚有处可安歇。此时，乘务员再次出现。' },
    { id: 'bad-room-coin', kind: 'change' as const, text: '钱币 +1', data: { stat: 'coin', delta: 1 } },
  ],
}
const repairedUnauthorizedRoom = repairKnownUnauthorizedLodgingPayment(persistedUnauthorizedRoom, cartridge)
equal(repairedUnauthorizedRoom.stats.coin, 6, '旧存档必须撤销未经授权的 +1')
ok(repairedUnauthorizedRoom.blocks.some((block) => block.kind === 'narration' && block.text.includes('没有确认付款')), '旧存档正文必须恢复为未付款事实')
ok(!repairedUnauthorizedRoom.blocks.some((block) => block.id === 'bad-room-coin'), '旧存档不得继续显示错误的 +1 变化条')
equal(repairKnownUnauthorizedLodgingPayment(repairedUnauthorizedRoom, cartridge).stats.coin, 6, '旧存档修复必须幂等')
const continuedAfterBadRoom = {
  ...persistedUnauthorizedRoom,
  stats: { ...persistedUnauthorizedRoom.stats, coin: 16 },
  blocks: [...persistedUnauthorizedRoom.blocks,
    { id: 'action-2', kind: 'event' as const, text: '完成一份短工' },
    { id: 'later-income', kind: 'change' as const, text: '钱币 +9', data: { stat: 'coin', delta: 9 } },
  ],
}
const repairedContinuedRoom = repairKnownUnauthorizedLodgingPayment(continuedAfterBadRoom, cartridge)
equal(repairedContinuedRoom.stats.coin, 15, '旧档继续游玩后只撤销坏回合的 +1')
ok(repairedContinuedRoom.blocks.some((block) => block.id === 'later-income'), '后续合法收入记录必须保留')

const doubled = parseStoryProtocol(`你完成装箱，她把九枚钱币递给你。
[job: action="offer" id="instant-packing" label="完成装箱" employer="码头雇主" wage="9"]
[job: action="settle" id="instant-packing"]
[widget: coin, add: 9]`, 'zh')
ok(validatePaymentConsistency(initial, doubled, cartridge).includes('job.settlement_must_not_duplicate_widget_credit'), '合同结算不能叠加 widget')
equal(applyParsedScene(initial, doubled, cartridge, '完成装箱').stats.coin, 15, 'reducer 防御必须避免双倍入账')
const canonicalDoubled = canonicalizePaymentMetadata(initial, doubled, cartridge, '完成装箱')
equal(validatePaymentConsistency(initial, canonicalDoubled, cartridge).length, 0, '本地规范化应移除合同结算旁的重复钱币指令')
equal(applyParsedScene(initial, canonicalDoubled, cartridge, '完成装箱').stats.coin, 15, '移除重复指令后工资仍只入账一次')

console.log(JSON.stringify({ ok: true, scheduledWageVariants, checks: ['offer-no-credit', 'contract-immutable', 'contract-settlement', 'repeat-rejected', 'screenshot-vague-payment', 'copper-coin-recognition', 'legacy-screenshot-repair', 'night-market-legacy-repair', 'amount-mismatch', 'purchase', 'promise-no-credit', 'offer-canonicalized', 'paid-work-canonicalized', 'purchase-canonicalized', 'no-double-credit', 'duplicate-credit-canonicalized'] }))
