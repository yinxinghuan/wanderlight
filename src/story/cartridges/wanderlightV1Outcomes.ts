import type { DemoTurn, Locale } from '../types'

export function wanderlightV1Outcomes(locale: Locale): DemoTurn[] {
  const zh = locale === 'zh'
  const miraBoundary = zh
    ? `你坐到空凳上。媛夕把那只干净杯子推给你，自己先喝了一口，证明里面只是葡萄园今晚的淡酒。

她说明天清晨要去记录转向最慢的一排藤。那份调查需要两个人，但报酬要到中午才结。她没有把邀请说成约会，也没有假装这件事不需要你承担时间。

[媛夕] [main] [坦率]: "你可以来，也可以只喝完这一杯。答应工作和答应陪我，不是同一件事。"
[reputation: npc="媛夕" action="respected-boundary"]
[choices: "答应清晨和媛夕一起调查葡萄藤"|"喝完这一杯，明天独自旅行"|"谢绝邀请，去田舍租一间房"]`
    : `You take the empty stool. Mira slides the clean cup toward you and drinks from her own first, making it clear that it holds only the vineyard's light table wine.

At dawn she must record the row of vines that turns most slowly. The survey needs two people, but it will not pay until noon. She does not call the invitation a date, and she does not pretend it costs you no time.

[Mira Voss] [main] [direct]: "You may come, or only finish this cup. Agreeing to the work and agreeing to keep me company are not the same promise."
[reputation: npc="Mira Voss" action="respected-boundary"]
[choices: "Join Mira's dawn vine survey"|"Finish the cup and travel alone tomorrow"|"Decline and rent a room at the field house"]`

  const miraCommitment = zh
    ? `你先确认了调查的时长和报酬，再答应清晨到东边藤架会合。媛夕在通行册的空白页上画了一条简单路线，随后把杯子收进篮子。

这不是一个要求你留下的承诺。它只是明天第一段共同的路，而且双方都知道什么时候结束。

[party_change: character="媛夕" character_id="mira-voss" change="add"]
[reputation: npc="媛夕" action="chose-to-travel"]
[state: value="和媛夕调查东边转向最慢的葡萄藤"]
[clock: value="第 2 天 · 06:10"]
[session_end: reason="你在银叶田舍休息到清晨。调查路线、报酬和与媛夕的约定都已保存。"]`
    : `You confirm the survey length and pay before agreeing to meet at the east trellis at dawn. Mira draws a simple route on a blank page of the passbook, then returns both cups to the basket.

This is not a promise that demands you stay. It is one shared road tomorrow, with an ending both of you understand.

[party_change: character="Mira Voss" character_id="mira-voss" change="add"]
[reputation: npc="Mira Voss" action="chose-to-travel"]
[state: value="Survey the slow-turning east vines with Mira"]
[clock: value="Day 2 · 06:10"]
[session_end: reason="You rest at the Silverleaf field house until dawn. The survey route, pay, and your agreement with Mira are saved."]`

  const rowanBoundary = zh
    ? `值夜陶艺师让你先试着调整窑门的上铰链。你托住门，罗温只负责递工具，没有把你的工作接过去。门重新合拢时，陶艺师当场付了九枚钱币。

罗温明早要检查一条通往雾杉林的旧支线。他愿意带你看路线，但先说明那不是乘务工作，也不会替你安排下一份职业。

[widget: energy, remove: 10]
[widget: coin, add: 9]
[reputation: npc="罗温" action="worked-as-equals"]
[choices: "答应明早和罗温检查通往雾杉林的旧支线"|"收下工钱，之后自己选路线"|"告诉罗温你今晚只想休息"]`
    : `The potter on night duty asks you to adjust the kiln door's upper hinge. You hold the door while Rowan passes tools without taking the job away from you. When the door closes cleanly, the potter pays you 9 coin on the spot.

Rowan will inspect an old branch toward Mistpine Forest in the morning. He is willing to show you the route, but says plainly that it is not steward work and that he will not choose your next trade for you.

[widget: energy, remove: 10]
[widget: coin, add: 9]
[reputation: npc="Rowan Hale" action="worked-as-equals"]
[choices: "Join Rowan's morning inspection of the Mistpine branch"|"Take the pay and choose your own route"|"Tell Rowan you only want to rest tonight"]`

  const rowanCommitment = zh
    ? `你答应只走完明早的支线检查，再决定是否继续同行。罗温在地图边缘标出会合月台，把备用测距绳交给你保管。

[party_change: character="罗温" character_id="rowan-hale" change="add"]
[reputation: npc="罗温" action="chose-to-travel"]
[state: value="和罗温检查通往雾杉林的旧支线"]
[clock: value="第 2 天 · 06:35"]
[session_end: reason="你在远灯研修院的客房休息。雾杉支线的会合地点和与罗温的同行边界都已保存。"]`
    : `You agree to complete only the morning branch inspection, then decide whether to keep traveling together. Rowan marks the meeting platform at the edge of the map and leaves the spare measuring cord with you.

[party_change: character="Rowan Hale" character_id="rowan-hale" change="add"]
[reputation: npc="Rowan Hale" action="chose-to-travel"]
[state: value="Inspect the old Mistpine branch with Rowan"]
[clock: value="Day 2 · 06:35"]
[session_end: reason="You rest in Far Lantern Institute's guest room. The Mistpine meeting point and the limits of your agreement with Rowan are saved."]`

  const celesteBoundary = zh
    ? `你和塞莱斯特沿木桥走了一圈，把会打滑的木板和挡住视线的渔网逐一移开。她在空场地中央拉了几个长音，确认海风不会把声音全送向水面。

演出结束后，她还要去下一处夜市。她邀请你负责布台，但把报酬、车票和工作结束时间一项项说清楚。

[reputation: npc="塞莱斯特" action="shared-the-stage"]
[choices: "接受塞莱斯特下一站的布台工作"|"演出后留在群岛接修网短工"|"听完清晨演出就和她告别"]`
    : `You walk the bridges with Celeste, moving a slippery board and each net that blocks the audience's view. At the center of the empty space, she holds several long notes to make sure the sea wind does not carry all the sound toward the water.

After the concert she will travel to another night market. She offers you the staging job, then states the pay, ticket cost, and finishing time one by one.

[reputation: npc="Celeste Ardin" action="shared-the-stage"]
[choices: "Take Celeste's staging job at the next market"|"Stay on the islands for net-mending work"|"Say goodbye after the dawn concert"]`

  const celesteCommitment = zh
    ? `你接受的是下一站的布台工作，不是无限期跟随。塞莱斯特把报酬写在结算夹上，撕下没有文字的一角作为你们的取物凭证。

[party_change: character="塞莱斯特" character_id="celeste-ardin" change="add"]
[reputation: npc="塞莱斯特" action="chose-to-travel"]
[state: value="和塞莱斯特完成下一站的布台工作"]
[clock: value="第 2 天 · 07:05"]
[session_end: reason="清晨演出结束。下一站的工作条件和与塞莱斯特的同行约定都已保存。"]`
    : `You accept the staging job at the next stop, not an open-ended obligation to follow. Celeste writes the pay on her settlement board and tears off one unlettered corner as your equipment token.

[party_change: character="Celeste Ardin" character_id="celeste-ardin" change="add"]
[reputation: npc="Celeste Ardin" action="chose-to-travel"]
[state: value="Complete the next staging job with Celeste"]
[clock: value="Day 2 · 07:05"]
[session_end: reason="The dawn concert is over. The next job's terms and your travel agreement with Celeste are saved."]`

  return [
    { match: zh ? ['空凳', '坐到媛夕对面'] : ['empty stool', 'across from Mira'], content: miraBoundary },
    { match: zh ? ['清晨和媛夕', '调查葡萄藤'] : ["Mira's dawn", 'dawn vine survey'], content: miraCommitment, imagePrompt: 'Silverleaf Vineyard at first light, Mira Voss and the off-camera player preparing a field notebook and two survey cords beside moon-turning vines, Mira is the single clear identity owner, quiet mutual agreement, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'mira-voss' },
    { match: zh ? ['修窑门', '介绍修窑'] : ['kiln-door', 'kiln door'], content: rowanBoundary },
    { match: zh ? ['雾杉支线', '雾杉林的旧支线', '明早和罗温'] : ["Rowan's morning", 'Mistpine branch'], content: rowanCommitment, imagePrompt: 'Far Lantern Institute guest corridor before dawn, Rowan Hale marking a route on a blank map edge and placing a measuring cord beside it, Rowan is the single clear identity owner, restrained mutual agreement, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'rowan-hale' },
    { match: zh ? ['帮塞莱斯特试场', '试场'] : ['check the dawn performance space', 'performance space'], content: celesteBoundary },
    { match: zh ? ['下一站的布台', '接受塞莱斯特'] : ["Celeste's staging job", 'next market'], content: celesteCommitment, imagePrompt: 'Tidal Islands just after a dawn concert, Celeste Ardin closing one instrument case beside neatly stacked stage equipment, Celeste is the single clear identity owner, a practical new travel agreement, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'celeste-ardin' },
  ]
}
