import type { AdapterResult, StoryAdapter } from '../types'
import { t } from '../i18n'
import { extractSceneImagePrompt, extractSceneImageSubject } from '../engine/protocol'
import { buildWorldContext, partyContinuityContract } from '../engine/worldContext'
import { dangerDirectiveContract } from '../engine/dangerDirector'
import { narrativeStyleContract } from '../narrativeStyle'

const endpoint = import.meta.env.VITE_STORY_API_ORIGIN || 'https://uu545921-zfkm-aec62664.westb.seetacloud.com:8443'

function decodeEvent(chunk: string): { event?: string; data?: unknown } | null {
  const lines = chunk.split('\n')
  const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
  const raw = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
  if (!raw) return null
  try { return { event, data: JSON.parse(raw) } } catch { return { event, data: raw } }
}

export const remoteAdapter: StoryAdapter = {
  id: 'remote',
  async send(action, context, onProgress): Promise<AdapterResult> {
    const chatId = context.save.remoteChatId || new URLSearchParams(window.location.search).get('chat_id')
    if (!chatId) throw new Error(t(context.locale, 'remoteMissing'))
    const sceneImageDirection = context.cartridge.sceneImageDirection ?? `${context.cartridge.theme.material} story-world editorial illustration`
    const sceneImageAvoid = context.cartridge.sceneImageAvoid?.trim()
    const imageFreshness = `Make it a fresh shot of the CURRENT visible event: current location first, then one dominant action, visible subjects, and a concrete camera scale or angle. For ordinary observation, dialogue, an object being presented, table work, a doorway/window view, or environmental change, prefer a FIRST-PERSON PLAYER-EYE VIEW in at least half of suitable proposals. In first person the camera is the protagonist's eyes: do not show the protagonist's face, head, back, shoulders, silhouette, reflection or body; do not invent their hands unless visible prose establishes them; never use image_subject=player. Reserve third-person player shots for actions that genuinely require the protagonist's full action, silhouette, clothing or spatial relation. Use at most two focal subjects and no montage. Never carry over the cover/opening composition, landmarks, foreground props, weather, vehicle, crossroads, room or skyline unless the current prose explicitly contains them.${sceneImageAvoid ? ` Opening residue to avoid unless explicitly present now: ${sceneImageAvoid}.` : ''}`
    const languageInstruction = context.locale === 'en'
      ? `\n\n[LANGUAGE AND FORMAT: Reply in English. Keep every protocol command tag and its syntax intact. End every response, including a genuine chapter checkpoint, with one to five currently executable actions in this machine-readable form: [choices: "Action one"|"Optional action two"|"Optional further actions"]. The count is not a quota: never add filler, and return only one or two when those are the only valid actions. Button actions must match the decisions described in the prose. Inventory is transactional: whenever prose says the player obtains, stores, gives away, loses, discards, or consumes an item, emit the matching [inventory: action="add|remove" ...] command in the same response; merely seeing an item is not ownership. For a visually distinctive new place, discovery, relationship turn, major result, or checkpoint, propose one English scene prompt using [image_prompt: "cinematic visible scene, no text, no UI, 4:3"], immediately followed by [image_subject: "player|environment|others"]. image_subject is reference-identity ownership: use player only when the player is the dominant visible human performing the main action and should receive the avatar reference; use others when a companion or NPC owns the action, even if the player is incidental or in the background; use environment for no-person or object-only shots. Never choose player merely because the prose mentions them or a wide shot contains a small player figure. Depict only visible established facts and follow this art direction: ${sceneImageDirection}. ${imageFreshness} Skip routine conversation.]`
      : `\n\n[语言与格式要求：请用简体中文回复，并保持所有协议命令标签及语法不变。每次回复（包括真正的章节节点）都必须在结尾用机器可读的 [choices: ...] 给出一到五个当前真正可执行的行动。数量不是任务：不得为凑数添加选项，如果只有一个或两个合法行动就只返回这些。按钮行动必须与正文描述的决定一致。物品状态必须与叙事同步：正文只要明确说玩家获得、收下、装入、交出、失去、丢弃或消耗了物品，同一回复就必须输出对应的 [inventory: action="add|remove" ...]；只看见或检查物品不等于归玩家所有。遇到具有明显视觉价值的新地点、发现、关系转折、重大结果或阶段节点时，用 [image_prompt: "English cinematic visible scene, no text, no UI, 4:3"] 提议一张场景图，并紧接着输出 [image_subject: "player|environment|others"]。image_subject 表示头像参考的归属，而不是统计画面里出现了谁：只有玩家是主要可见人物并执行画面主动作、确实应继承头像时才用 player；同伴或 NPC 主导动作时用 others，即使玩家只是陪衬或远景也不传头像；无人或物品空镜用 environment。不能只因为正文提到玩家或远景里有小小的玩家身影就选择 player。只画正文已经公开的事实，并遵循这一画风：${sceneImageDirection}。${imageFreshness} 普通对话不要提议。]`
    const dangerContract = dangerDirectiveContract(context.dangerDirective)
    const decisionAnchorContract = 'DECISION ANCHOR: Normally omit it. Only if all choices need one shared premise that their labels cannot express, emit [situation: "Independent paraphrase"] with at most 28 Chinese or 96 English characters. Never copy a prose sentence or instruct the player to choose.'
    const turnConsistencyContract = `TURN CONSISTENCY: Every response emits exactly one [scene_location: location="Exact current visible location label"] matching authoritative state after any map_update. A visible arrival requires [map_update: new_location="Place" location_id="stable-kebab-id" connected_to="Previous place" detail="Visible condition" route_hints="Visible alias|Visible sublocation"]. Reuse the same location_id whenever that generated place returns or gains a visibly established alias/sublocation; route_hints may contain only names and concrete sublocations stated in visible prose, never hidden synonyms. A new current task requires [state: value="Exact current objective"]. Choices must belong to that scene, never the prior location. When image_prompt is emitted, also emit [image_location: location="Same exact location label as scene_location"] before image_subject.`
    const dialogueImageContract = `IMPORTANT DIALOGUE IMAGE: Importance belongs to the line, not the fame of the speaker. When dialogue reveals a consequential fact, changes a relationship, sets a boundary, makes a promise or request, warns of danger, establishes a task, or carries a strong emotional turn, emit [dialogue_focus: speaker="Exact visible speaker name" expression="Concise visible facial and body-language cue"]. Do not tag short administrative acknowledgements. The local director will force a contextual expression shot and may override a generic environment proposal.`
    const stateDisplayContract = 'STATE DISPLAY: Never print a status-update heading or list current values, location, role, objective, or inventory in visible prose. Describe consequences naturally; submit numeric changes through widget commands, except paid-work settlement which must use the authoritative job command.'
    const paymentContract = 'PAYMENT CONSISTENCY: Quote an exact amount for every offer and completed transfer. Words such as 报酬、工钱、薪水、工资、pay, wages, salary, and compensation are money claims too: never say the player earned, received, collected, or was handed them unless that same visible sentence states the exact coin amount and the matching command settles it. Paid work is authoritative: emit [job: action="offer" id="stable-kebab-id" label="Concrete work" employer="Visible employer" wage="NUMBER"] when work is offered and [job: action="settle" id="same-id"] only when it is visibly completed and paid. Settlement credits the recorded wage locally; never also add a coin widget. Direct non-job gifts use [widget: coin, add: NUMBER]. NEVER spend player coin unless the current player action explicitly authorizes the exact purchase; asking, looking, considering, or hearing a price is not consent. A budget-only instruction such as “spend all my money / 把钱全部花完” is not purchase authorization: ask what to buy and do not narrate any coin as spent. Authorized purchases use [widget: coin, remove: NUMBER]. Promises never change coin.'
    const choiceFormatContract = 'CHOICE FORMAT AND CONTINUITY: Put choices only in the final [choices: ...] command. Never repeat them in visible prose as bullets, a numbered list, or a “you can / 你现在可以” paragraph. Every choice must reuse exact concrete noun phrases already visible in this response or authoritative state; never rely on a synonym or one generic overlapping word to introduce a new person, place, object, institution, or goal. Every choice must answer the most immediate unresolved event. While a threat, interruption, unfinished task, waiting person, or action in progress remains, do not offer unrelated work, travel, food, rest, generic observation, or “discuss what to do”; name the exact person, object, obstacle, or next physical step. Never re-offer PLAYER_ACTION or a retry-prefixed paraphrase. Each choice must lead to a materially different immediate consequence instead of returning to the same wording or menu.'
    const repairContract = context.repair
      ? `\n\nOUTPUT_REPAIR_REQUIRED:\nThe previous draft was rejected before local state commit. Rewrite the complete response for the SAME action and state. Fix every violation and do not mention the repair.\nVIOLATIONS:\n${context.repair.violations.map((violation) => `- ${violation}`).join('\n')}\nREJECTED_DRAFT:\n${context.repair.draft}`
      : ''
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        userMessage: `AUTHORITATIVE_WORLD_STATE_JSON:\n${JSON.stringify(buildWorldContext(context))}\n\n${narrativeStyleContract(context.locale)}\n\n${partyContinuityContract}\n${dangerContract}\n${decisionAnchorContract}\n${stateDisplayContract}\n${paymentContract}\n${choiceFormatContract}\n\nPLAYER_ACTION:\n${action}${languageInstruction}\n${turnConsistencyContract}\n${dialogueImageContract}${repairContract}`,
        streaming: false,
      }),
    })
    if (!response.ok || !response.body) throw new Error(t(context.locale, 'remoteUnavailableError', { n: response.status }))
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalContent = ''
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const chunks = buffer.split(/\n\n+/)
      buffer = chunks.pop() ?? ''
      chunks.forEach((chunk) => {
        const message = decodeEvent(chunk)
        if (!message || message.event === 'thinking') return
        const data = message.data as Record<string, unknown> | string
        if (message.event === 'progress') onProgress?.({ label: typeof data === 'string' ? data : String(data?.message ?? t(context.locale, 'worldResponding')) })
        if (message.event === 'message_saved' && typeof data === 'object') {
          const nested = data.message as Record<string, unknown> | undefined
          finalContent = String(data.content ?? nested?.content ?? '')
        }
      })
      if (done) break
    }
    if (!finalContent) throw new Error(t(context.locale, 'remoteEmpty'))
    return { content: finalContent, imagePrompt: extractSceneImagePrompt(finalContent), imageSubject: extractSceneImageSubject(finalContent) }
  },
}
