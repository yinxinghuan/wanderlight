import type { JobContract, ParsedCommand, ParsedScene, StoryCartridge, StorySave } from '../types'

type JobCommand = Extract<ParsedCommand, { type: 'job' }>
type WidgetCommand = Extract<ParsedCommand, { type: 'widget' }>

function chineseInteger(value: string): number | undefined {
  if (/^\d{1,3}$/.test(value)) return Number(value)
  const digits: Record<string, number> = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 }
  if (!/^[零〇一二两三四五六七八九十百]+$/.test(value)) return undefined
  let total = 0
  let current = 0
  for (const character of value) {
    if (character === '十' || character === '百') {
      const unit = character === '十' ? 10 : 100
      total += (current || 1) * unit
      current = 0
    } else current = digits[character]
  }
  return total + current
}

export function exactCoinAmount(text: string, locale: StoryCartridge['locale']): number | undefined {
  if (locale === 'zh' && /(?:这|该|那)\s*枚\s*(?:钱币|铜板|铜币|硬币|金币|银币)/.test(text)) return 1
  const match = locale === 'zh'
    ? text.match(/(\d{1,3}|[零〇一二两三四五六七八九十百]{1,5})\s*(?:枚|个)?\s*(?:钱币|铜板|铜币|硬币|金币|银币)/)
    : text.match(/(\d{1,3})\s+(?:coins?|coppers?|crowns?|tokens?)/i)
  if (!match) return undefined
  const amount = locale === 'zh' ? chineseInteger(match[1]) : Number(match[1])
  return amount && amount > 0 ? Math.min(30, amount) : undefined
}

/** A generated scene may describe a price, but it may only complete a purchase
 * when the player's selected action clearly authorized spending. Looking for,
 * asking about, or considering an option is not consent to pay. */
export function actionAuthorizesCoinSpend(action: string, locale: StoryCartridge['locale']): boolean {
  const source = action.trim()
  if (!source) return false
  if (locale === 'zh') {
    const denied = /(?:不|不要|别|暂不|先不|尚未|没有|拒绝)[^。！？]{0,8}(?:支付|付款|付钱|付房费|花钱|购买|买下|买票|订房|预订|租房|结账)/
    if (denied.test(source)) return false
    const direct = /(?:支付|付款|付钱|付房费|花(?:掉|费|完)?(?:钱|这|那|一|\d|[零〇一二两三四五六七八九十百])|购买|买下|买票|订房|预订房间|租(?:一间|个)?房|住一晚|要一间房|结账|买一顿饭)/
    if (!direct.test(source)) return false
    const exploratory = /(?:询问|问问|了解|打听|查看|看看|考虑|寻找|比较)[^。！？]{0,20}(?:房费|价格|费用|住宿|交通|车票|饭)/
    const explicitAfterExploration = /(?:并|然后|随后|确认后)[^。！？]{0,10}(?:支付|付款|付钱|买下|购买|订房|买票|结账)/
    return !exploratory.test(source) || explicitAfterExploration.test(source)
  }
  const denied = /(?:do not|don't|refuse to|not yet|without)\s+(?:pay|spend|buy|book|rent)/i
  if (denied.test(source)) return false
  const direct = /\b(?:pay|spend|buy|purchase|book|reserve|rent|check out|stay (?:for )?the night)\b/i
  if (!direct.test(source)) return false
  const exploratory = /\b(?:ask|inquire|learn|check|consider|look for|compare)\b.{0,32}\b(?:price|cost|fare|room|lodging|transport|ticket|meal)\b/i
  const explicitAfterExploration = /\b(?:and|then|after confirming)\b.{0,16}\b(?:pay|buy|purchase|book|reserve|rent)\b/i
  return !exploratory.test(source) || explicitAfterExploration.test(source)
}

function commandDelta(command: WidgetCommand): number {
  const value = Number(command.value)
  if (!Number.isFinite(value)) return 0
  return command.operation === 'remove' ? -Math.abs(value) : command.operation === 'add' ? Math.abs(value) : 0
}

function jobForCommand(save: StorySave, offers: JobCommand[], command: JobCommand): JobContract | undefined {
  const persisted = save.jobs.find((job) => job.id === command.id)
  if (persisted) return persisted
  const offered = offers.find((offer) => offer.id === command.id && offer.action === 'offer' && offer.wage)
  return offered?.wage ? {
    id: offered.id, label: offered.label ?? offered.id, employer: offered.employer,
    wage: offered.wage, status: 'offered', offeredAtScene: save.scene + 1,
  } : undefined
}

function stableJobId(save: StorySave, action: string): string {
  let hash = 2166136261
  for (const character of `${save.scene + 1}:${action}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `story-job-${save.scene + 1}-${(hash >>> 0).toString(36)}`
}

/** Add only deterministic transaction commands that are already explicit in
 * visible prose. This keeps exact payments playable when a model omits the
 * machine tag, without guessing vague amounts or crediting a promise. */
export function canonicalizePaymentMetadata(
  save: StorySave,
  parsed: ParsedScene,
  cartridge: StoryCartridge,
  action: string,
): ParsedScene {
  const prose = parsed.blocks
    .filter((block) => block.kind === 'narration' || block.kind === 'dialogue')
    .map((block) => block.text).join('\n')
  const sentences = prose.split(/(?<=[。！？.!?])|\n+/).map((sentence) => sentence.trim()).filter(Boolean)
  const currency = /(?:钱币|铜板|铜币|硬币|金币|银币|coins?|coppers?|crowns?|tokens?)/i
  const received = cartridge.locale === 'zh'
    ? /(?:递给你|交给你|付给你|支付给你|给了你|数给你|塞给你|(?:放进|放到|放入)你手里|当场付了|当场结清|已经结清|收到了?)/
    : /(?:paid you|pays you|handed you|hands you|gave you|passed you|counted out|you received|places?.{0,32}(?:coins?|coppers?|crowns?|tokens?).{0,16}(?:in|into) your hand|payment (?:was|is) settled)/i
  const spent = cartridge.locale === 'zh'
    ? /(?:你(?:当场)?(?:支付|付了|交了|付清|结清)|你(?:用|拿出|掏出|交出)[^。！？]{0,20}(?:支付|付了|交了|付清|结清)|从你[^。！？]{0,16}扣除)/
    : /(?:you paid|you (?:used|took out|handed over).{0,24}(?:to pay|as payment)|was deducted from you)/i
  const promise = cartridge.locale === 'zh'
    ? /(?:如果|等你?|(?:完成|做完|搬完|送完|修完)[^。！？]{0,12}(?:(?:之后|以后)|后(?=[，,\s我你她他会将再])|再)|再?帮(?:我|忙)?)[^。！？]{0,48}(?:会|将|给你|付你|报酬|工钱)/
    : /(?:(?:if|when|after).{0,64}(?:will pay|pay you|wage|payment)|help.{0,64}(?:i(?:'ll| will) pay|pay you))/i
  const completedTransfer = /(?:工作|任务|整理|搬运|装箱|修理|运送)[^。！？]{0,12}(?:完成|做完|搬完|送完|修完)后[，,][^。！？]{0,36}(?:递给你|交给你|付给你|给了你|塞给你|结清|收到)/
  const workContext = /(?:工作|短工|帮忙|干活|这份活|任务|报酬|工钱|搬|修|送|封好|装箱|work|job|shift|help|task|wage|repair|carry|deliver|pack)/i.test(prose)
  const receivedSentence = sentences.find((sentence) => currency.test(sentence) && received.test(sentence)
    && (!promise.test(sentence) || (completedTransfer.test(sentence) && !/(?:等你|如果|会|将)/.test(sentence))))
  const spentSentence = sentences.find((sentence) => currency.test(sentence) && spent.test(sentence) && !promise.test(sentence))
  const promisedSentence = sentences.find((sentence) => currency.test(sentence) && promise.test(sentence) && !received.test(sentence))
  let commands = parsed.commands
  const jobs = () => commands.filter((command): command is JobCommand => command.type === 'job')
  const widgets = () => commands.filter((command): command is WidgetCommand => command.type === 'widget' && command.id === 'coin')
  const label = action.trim().slice(0, 80) || (cartridge.locale === 'zh' ? '本次工作' : 'Current work')
  const employer = [...parsed.blocks].reverse().find((block) => block.kind === 'dialogue' && block.speaker)?.speaker
  const addOffer = (amount: number): JobCommand => ({
    type: 'job', action: 'offer', id: stableJobId(save, action), label,
    employer: employer || (cartridge.locale === 'zh' ? '当前雇主' : 'Current employer'), wage: amount,
  })

  if (promisedSentence) {
    const amount = exactCoinAmount(promisedSentence, cartridge.locale)
    const active = amount ? save.jobs.find((job) => job.wage === amount && (job.status === 'offered' || job.status === 'accepted')) : undefined
    if (amount && !active && !jobs().some((command) => command.action === 'offer')) commands = [...commands, addOffer(amount)]
    commands = commands.filter((command) => command.type !== 'widget' || command.id !== 'coin' || commandDelta(command) <= 0)
  }

  if (receivedSentence) {
    const amount = exactCoinAmount(receivedSentence, cartridge.locale)
    if (amount && workContext && !jobs().some((command) => command.action === 'settle')) {
      const active = save.jobs.find((job) => job.wage === amount && (job.status === 'offered' || job.status === 'accepted'))
      if (active) commands = [...commands, { type: 'job', action: 'settle', id: active.id }]
      else {
        const offer = addOffer(amount)
        commands = [...commands, offer, { type: 'job', action: 'settle', id: offer.id }]
      }
    } else if (amount && !workContext && !jobs().some((command) => command.action === 'settle') && !widgets().some((command) => commandDelta(command) === amount)) {
      commands = [...commands, { type: 'widget', id: 'coin', operation: 'add', value: amount }]
    }
  }

  if (spentSentence) {
    const amount = exactCoinAmount(spentSentence, cartridge.locale)
    if (amount && actionAuthorizesCoinSpend(action, cartridge.locale)) {
      commands = commands.filter((command) => command.type !== 'widget' || command.id !== 'coin')
      commands = [...commands, { type: 'widget', id: 'coin', operation: 'remove', value: amount }]
    }
  }

  if (jobs().some((command) => command.action === 'settle')) {
    commands = commands.filter((command) => command.type !== 'widget' || command.id !== 'coin' || commandDelta(command) <= 0)
  }

  return commands === parsed.commands ? parsed : { ...parsed, commands }
}

export function validatePaymentConsistency(save: StorySave, parsed: ParsedScene, cartridge: StoryCartridge, action = ''): string[] {
  const violations = new Set<string>()
  const prose = parsed.blocks
    .filter((block) => block.kind === 'narration' || block.kind === 'dialogue')
    .map((block) => block.text).join('\n')
  const sentences = prose.split(/(?<=[。！？.!?])|\n+/).map((sentence) => sentence.trim()).filter(Boolean)
  const currency = /(?:钱币|铜板|铜币|硬币|金币|银币|coins?|coppers?|crowns?|tokens?)/i
  const received = cartridge.locale === 'zh'
    ? /(?:递给你|交给你|付给你|支付给你|给了你|数给你|塞给你|(?:放进|放到|放入)你手里|当场付了|当场结清|已经结清|收到了?)/
    : /(?:paid you|pays you|handed you|hands you|gave you|passed you|counted out|you received|places?.{0,32}(?:coins?|coppers?|crowns?|tokens?).{0,16}(?:in|into) your hand|payment (?:was|is) settled)/i
  const spent = cartridge.locale === 'zh'
    ? /(?:你(?:当场)?(?:支付|付了|交了|付清|结清)|你(?:用|拿出|掏出|交出)[^。！？]{0,20}(?:支付|付了|交了|付清|结清)|从你[^。！？]{0,16}扣除)/
    : /(?:you paid|you (?:used|took out|handed over).{0,24}(?:to pay|as payment)|was deducted from you)/i
  const promise = cartridge.locale === 'zh'
    ? /(?:如果|等你?|(?:完成|做完|搬完|送完|修完)[^。！？]{0,12}(?:(?:之后|以后)|后(?=[，,\s我你她他会将再])|再)|再?帮(?:我|忙)?)[^。！？]{0,48}(?:会|将|给你|付你|报酬|工钱)/
    : /(?:(?:if|when|after).{0,64}(?:will pay|pay you|wage|payment)|help.{0,64}(?:i(?:'ll| will) pay|pay you))/i
  const completedTransfer = /(?:工作|任务|整理|搬运|装箱|修理|运送)[^。！？]{0,12}(?:完成|做完|搬完|送完|修完)后[，,][^。！？]{0,36}(?:递给你|交给你|付给你|给了你|塞给你|结清|收到)/
  const workContext = /(?:工作|短工|帮忙|干活|这份活|任务|报酬|工钱|搬|修|送|封好|装箱|work|job|shift|help|task|wage|repair|carry|deliver|pack)/i.test(prose)
  const receivedSentence = sentences.find((sentence) => currency.test(sentence) && received.test(sentence)
    && (!promise.test(sentence) || (completedTransfer.test(sentence) && !/(?:等你|如果|会|将)/.test(sentence))))
  const spentSentence = sentences.find((sentence) => currency.test(sentence) && spent.test(sentence) && !promise.test(sentence))
  const promisedSentence = sentences.find((sentence) => currency.test(sentence) && promise.test(sentence) && !received.test(sentence))
  const widgets = parsed.commands.filter((command): command is WidgetCommand => command.type === 'widget' && command.id === 'coin')
  const additions = widgets.filter((command) => commandDelta(command) > 0)
  const removals = widgets.filter((command) => commandDelta(command) < 0)
  const jobs = parsed.commands.filter((command): command is JobCommand => command.type === 'job')
  const offers = jobs.filter((command) => command.action === 'offer')
  const settlements = jobs.filter((command) => command.action === 'settle')

  offers.forEach((offer) => {
    if (!offer.wage || !offer.label) violations.add('job.offer_requires_id_label_and_wage')
    const persisted = save.jobs.find((job) => job.id === offer.id)
    if (persisted && (persisted.wage !== offer.wage || persisted.label !== offer.label || persisted.status === 'settled' || persisted.status === 'cancelled')) violations.add('job.offer_cannot_rewrite_contract')
    const visibleAmount = promisedSentence ? exactCoinAmount(promisedSentence, cartridge.locale) : receivedSentence ? exactCoinAmount(receivedSentence, cartridge.locale) : undefined
    if (!visibleAmount || visibleAmount !== offer.wage) violations.add('job.offer_wage_must_be_visible_and_exact')
  })

  const promisedAmount = promisedSentence ? exactCoinAmount(promisedSentence, cartridge.locale) : undefined
  const matchingActiveContract = promisedAmount
    ? save.jobs.some((job) => job.wage === promisedAmount && (job.status === 'offered' || job.status === 'accepted'))
    : false
  if (promisedSentence && offers.length === 0 && !matchingActiveContract) violations.add('job.visible_offer_requires_contract')
  if (promisedSentence && additions.length) violations.add('payment.promise_must_not_credit_coin')

  if (receivedSentence) {
    const visibleAmount = exactCoinAmount(receivedSentence, cartridge.locale)
    if (!visibleAmount) violations.add('payment.completed_payment_requires_exact_amount')
    if (workContext && settlements.length === 0) violations.add('job.completed_work_requires_settlement')
    if (!workContext && settlements.length === 0 && (!visibleAmount || !additions.some((command) => commandDelta(command) === visibleAmount))) {
      violations.add('payment.receipt_requires_matching_coin_add')
    }
  } else if (settlements.length) violations.add('job.settlement_must_be_visible')

  settlements.forEach((settlement) => {
    const contract = jobForCommand(save, offers, settlement)
    if (!contract) violations.add('job.settlement_requires_contract')
    if (contract?.status === 'settled' || contract?.status === 'cancelled') violations.add('job.settlement_cannot_repeat')
    const visibleAmount = receivedSentence ? exactCoinAmount(receivedSentence, cartridge.locale) : undefined
    if (contract && visibleAmount !== contract.wage) violations.add('job.settlement_amount_must_match_contract')
  })
  if (settlements.length && additions.length) violations.add('job.settlement_must_not_duplicate_widget_credit')
  if (additions.length && !receivedSentence && settlements.length === 0) violations.add('payment.coin_add_requires_visible_receipt')

  if (spentSentence) {
    const visibleAmount = exactCoinAmount(spentSentence, cartridge.locale)
    if (!actionAuthorizesCoinSpend(action, cartridge.locale)) violations.add('payment.purchase_requires_player_authorization')
    if (!visibleAmount) violations.add('payment.completed_purchase_requires_exact_amount')
    if (!visibleAmount || !removals.some((command) => commandDelta(command) === -visibleAmount)) violations.add('payment.purchase_requires_matching_coin_remove')
    if (additions.length) violations.add('payment.purchase_must_not_credit_coin')
  }
  if (removals.length && !spentSentence) violations.add('payment.coin_remove_requires_visible_purchase')
  if (removals.length && !actionAuthorizesCoinSpend(action, cartridge.locale)) violations.add('payment.coin_remove_requires_player_authorization')

  return [...violations]
}

export function repairKnownPaymentGap<T extends {
  scene: number
  stats: Record<string, number>
  facts?: StorySave['facts']
  blocks: StorySave['blocks']
  jobs?: StorySave['jobs']
}>(candidate: T, cartridge: StoryCartridge): T {
  const visible = candidate.blocks
    .filter((block) => block.kind === 'narration' || block.kind === 'dialogue')
    .slice(-24).map((block) => block.text).join('\n')
  const definition = cartridge.statDefinitions.find((stat) => stat.id === 'coin')
  if (!definition) return candidate
  const knownGap = [
    {
      id: 'legacy-mira-seed-cold-storage-v1',
      matches: /这些种荚马上可以送去冷藏了/.test(visible) && /掏出几枚铜板递给你/.test(visible),
      label: '把发光种荚封好送去冷藏', employer: '媛夕', wage: 8,
    },
    {
      id: 'legacy-night-market-sauce-sorting-v1',
      matches: /整理工作完成后/.test(visible) && /一个小布袋/.test(visible) && /几枚铜币/.test(visible) && /这是你的报酬/.test(visible),
      label: '整理夜市风味酱料', employer: '短发女人', wage: 8,
    },
  ].find((entry) => entry.matches && !candidate.facts?.[entry.id])
  if (!knownGap) return candidate
  return {
    ...candidate,
    stats: { ...candidate.stats, coin: Math.min(definition.max, Number(candidate.stats.coin) + knownGap.wage) },
    facts: { ...(candidate.facts ?? {}), [knownGap.id]: true, jobs_completed: Number(candidate.facts?.jobs_completed ?? 0) + 1 },
    jobs: [...(candidate.jobs ?? []), {
      id: knownGap.id, label: knownGap.label, employer: knownGap.employer, wage: knownGap.wage,
      status: 'settled', offeredAtScene: Math.max(0, candidate.scene - 1), settledAtScene: candidate.scene,
    }],
  } as T
}

/** Repairs the already-persisted Wanderlight scene that both invented an inn
 * payment and credited one coin. The migration is deliberately exact and only
 * runs when the recorded player action did not authorize spending. */
export function repairKnownUnauthorizedLodgingPayment<T extends {
  stats: Record<string, number>
  facts?: StorySave['facts']
  blocks: StorySave['blocks']
}>(candidate: T, cartridge: StoryCartridge): T {
  const migrationId = 'legacy-unauthorized-lodging-payment-v1'
  if (cartridge.id !== 'wanderlight' || candidate.facts?.[migrationId]) return candidate
  const narrationIndex = candidate.blocks.findIndex((block) => block.kind === 'narration'
    && /你用这枚硬币支付了码头楼上旅店的房费/.test(block.text))
  if (narrationIndex < 0) return candidate
  let action = ''
  for (let index = narrationIndex - 1; index >= 0; index -= 1) {
    const block = candidate.blocks[index]
    if (block.kind === 'event' && /^action-\d+$/.test(block.id)) { action = block.text; break }
  }
  if (actionAuthorizesCoinSpend(action, cartridge.locale)) return candidate
  const nextActionIndex = candidate.blocks.findIndex((block, index) => index > narrationIndex && block.kind === 'event' && /^action-\d+$/.test(block.id))
  const sceneEnd = nextActionIndex < 0 ? candidate.blocks.length : nextActionIndex
  const credited = candidate.blocks.reduce((total, block, index) => {
    if (index <= narrationIndex || index >= sceneEnd || block.kind !== 'change' || block.data?.stat !== 'coin') return total
    const delta = Number(block.data?.delta ?? 0)
    return delta > 0 ? total + delta : total
  }, 0)
  if (credited !== 1) return candidate
  const definition = cartridge.statDefinitions.find((stat) => stat.id === 'coin')
  const correctedText = cartridge.locale === 'zh'
    ? '你只向码头楼上的旅店询问了房费，没有确认付款，也没有订下房间。'
    : 'You only asked the inn above the quay about its room rate. You did not authorize payment or book a room.'
  const blocks = candidate.blocks
    .map((block, index) => index === narrationIndex
      ? { ...block, text: block.text.replace(/你用这枚硬币支付了码头楼上旅店的房费，确保了今晚有处可安歇。?/, correctedText) }
      : block)
    .filter((block, index) => !(index > narrationIndex && index < sceneEnd && block.kind === 'change' && block.data?.stat === 'coin' && Number(block.data?.delta) > 0))
  return {
    ...candidate,
    stats: { ...candidate.stats, coin: Math.max(definition?.min ?? 0, Number(candidate.stats.coin) - credited) },
    facts: { ...(candidate.facts ?? {}), [migrationId]: true },
    blocks,
  } as T
}
