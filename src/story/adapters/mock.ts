import type { StoryAdapter } from '../types'
import { t } from '../i18n'
import { domainDemoContent } from '../engine/domainRules'

function upgradeAuthoredPaidWork(content: string, scene: number, locale: 'zh' | 'en'): string {
  const match = content.match(/\[widget:\s*coin,\s*add:\s*(\d{1,2})\s*]/i)
  if (!match) return content
  const wage = Number(match[1])
  const id = `authored-paid-work-${scene}`
  const label = locale === 'zh' ? '完成这份已约定的短工' : 'Complete the agreed local job'
  const employer = locale === 'zh' ? '当前雇主' : 'Current employer'
  return content.replace(match[0], `[job: action="offer" id="${id}" label="${label}" employer="${employer}" wage="${wage}"]\n[job: action="settle" id="${id}"]`)
}

export const mockAdapter: StoryAdapter = {
  id: 'demo',
  async send(action, context, onProgress) {
    onProgress?.({ label: t(context.locale, 'worldResponding'), percent: 24 })
    await new Promise((resolve) => window.setTimeout(resolve, 360))
    const normalized = action.toLowerCase()
    const unused = context.cartridge.demoTurns
      .map((turn, index) => {
        if (index < context.save.scene) return null
        const matches = turn.match.map((keyword) => keyword.toLowerCase()).filter((keyword) => normalized.includes(keyword))
        if (!matches.length) return null
        // Prefer the most specific phrase. A generic word such as "help" must
        // not steal an authored route from "move cases at the night market".
        return { turn, index, score: Math.max(...matches.map((keyword) => keyword.length)) * 100 + matches.length }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.turn
    const turn = unused ?? context.cartridge.demoTurns[context.save.scene]
    onProgress?.({ label: t(context.locale, 'checkingState'), percent: 68 })
    await new Promise((resolve) => window.setTimeout(resolve, 440))
    if (context.domainResolution) return { content: domainDemoContent(context.domainResolution) }
    if (turn) return { content: upgradeAuthoredPaidWork(turn.content, context.save.scene + 1, context.locale), imagePrompt: turn.imagePrompt, imageSubject: turn.imageSubject, imageCharacterId: turn.imageCharacterId }
    throw new Error(t(context.locale, 'demoComplete'))
  },
}
