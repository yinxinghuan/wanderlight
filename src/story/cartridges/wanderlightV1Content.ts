import type { DemoTurn, Locale } from '../types'

export function wanderlightV1Content(locale: Locale): DemoTurn[] {
  const zh = locale === 'zh'
  const rowanDebut = zh
    ? `乘务员把招工牌放低。那是个三十一岁的男人，黑色短卷发，戴窄边金属眼镜，靛蓝外套左领夹着银色票夹。他没有先问你的名字，而是把一只打开的路线箱推到你面前。\n\n箱盖内侧的值班卡写着“罗温·黑尔”。几张被雨打湿的路线卡粘在一起，沿海地图也泡皱了一角。\n\n[罗温] [main] [冷静]: "先把颜色相同的路线卡分开。二十分钟，六枚钱币。地图不用你修，除非你真的会。"\n\n你按颜色分开路线卡，又用吸水布垫住地图湿角。二十分钟后，罗温验完最后一叠卡，把六枚钱币当场交给你。\n[character_update: character_id="rowan-hale" character="罗温" role="31 岁 · 月线乘务与地图修复师" detail="在灯湾月台整理被雨打湿的夜班路线" vitality="74" stress="31"]\n[widget: coin, add: 6]\n[reputation: npc="罗温" action="helped"]\n[choices: "帮罗温把泡皱的地图压平"|"收好钱币，做完就走"|"问罗温哪条夜班路线最缺人"]`
    : `The steward lowers the hiring sign. He is thirty-one, with close-curled black hair, narrow metal glasses, and a silver ticket clip on the left lapel of his indigo coat. Instead of asking your name, he pushes an open route case toward you.\n\nThe duty card inside the lid reads “Rowan Hale.” Several rain-soaked route cards have stuck together, and one corner of the coastal map has buckled.\n\n[Rowan Hale] [main] [calm]: "Separate the route cards by color first. Twenty minutes, 6 coin. Leave the map unless you actually know how to mend paper."\n\nYou sort the route cards by color and protect the wet map corner with absorbent cloth. Twenty minutes later, Rowan checks the final stack and pays you 6 coin on the spot.\n[character_update: character_id="rowan-hale" character="Rowan Hale" role="Age 31 · Moonline steward and map restorer" detail="Sorting rain-damaged night routes at Lantern Quay" vitality="74" stress="31"]\n[widget: coin, add: 6]\n[reputation: npc="Rowan Hale" action="helped"]\n[choices: "Help Rowan flatten the buckled map"|"Pocket the coin and leave after the shift"|"Ask Rowan which night route needs workers"]`

  const rowanDebutContract = rowanDebut.replace(
    '[widget: coin, add: 6]',
    zh
      ? '[job: action="offer" id="rowan-opening-route-cards" label="整理被雨打湿的夜班路线卡" employer="罗温" wage="6"]\n[job: action="settle" id="rowan-opening-route-cards"]'
      : '[job: action="offer" id="rowan-opening-route-cards" label="Sort the rain-soaked night route cards" employer="Rowan Hale" wage="6"]\n[job: action="settle" id="rowan-opening-route-cards"]',
  )

  const rowanWork = zh
    ? `你没有去抹开湿纸，而是先垫上吸水布，再从地图干燥的一边慢慢压平。罗温看见你的手法，把准备阻止你的手收了回去。\n\n最后一张路线卡归位时，他把地图转向你。远灯研修院旁边有一段海岸线被雨水洗掉了。那是一所只招收成年人的职业研修院，今晚正有人等这张图安排物资。\n\n[罗温] [main] [认真]: "我得亲自送过去。你可以搭这班车，也可以拿着工钱去别处。别因为我开口，就把它当成欠我的。"\n[reputation: npc="罗温" action="trusted"]\n[choices: "和罗温把地图送去远灯研修院"|"留在灯湾继续找短工"|"先上月线，在车厢里休息"]`
    : `You do not smear the wet paper. You place absorbent cloth beneath it and work slowly from the dry edge. Rowan notices the method and lowers the hand he was about to use to stop you.\n\nWhen the last route card is sorted, he turns the map toward you. Rain has erased part of the coast beside Far Lantern Institute, an adult vocational campus waiting on this map to schedule supplies tonight.\n\n[Rowan Hale] [main] [serious]: "I need to deliver it myself. You may ride with me, or take your pay elsewhere. An invitation is not a debt."\n[reputation: npc="Rowan Hale" action="trusted"]\n[choices: "Deliver the map to Far Lantern Institute with Rowan"|"Stay in Lantern Quay and find more work"|"Board the Moonline and rest in the carriage"]`

  const rowanTransit = zh
    ? `罗温把地图收进防水筒，你们从月台登上末班车。他确认箱子锁好，才在对面坐下。防水筒里仍是那张缺失一段海岸线的地图。\n\n车门合上。灯湾的雨棚和招工牌向后退去，只剩车轮经过接缝时规律的两声轻响。\n\n[clock: value="第一晚 · 19:22"]\n[map_update: new_location="月线车厢" connected_to="灯湾码头" detail="开往远灯研修院的末班车"]\n[choices: "和罗温谈谈那张缺失的海岸线"|"靠着车窗休息一会儿"|"到站后自己先下车"]`
    : `Rowan slides the map into a waterproof tube, and you board the last train from the platform. He checks the case lock before taking the seat opposite you. The missing stretch of coast is still sealed inside with the map.\n\nThe doors close. Lantern Quay’s awnings and hiring signs fall behind, leaving only the steady double beat of wheels crossing each rail joint.\n\n[clock: value="First evening · 19:22"]\n[map_update: new_location="Moonline Carriage" connected_to="Lantern Quay" detail="The last train to Far Lantern Institute"]\n[choices: "Ask Rowan about the missing stretch of coast"|"Rest against the carriage window"|"Get off first when the train arrives"]`

  const rowanReunion = zh
    ? `列车停在远灯站。你穿过短月台，走进一座灯火通明的石院。敞开的工坊里摆着陶轮、修理台和观测仪，没有制服，也没有未成年人。\n\n罗温已经摘下乘务帽，窄边眼镜和左领的银色票夹仍让你认出他。他把地图交给值夜的陶艺师，却没有替你决定要不要留下。\n\n[罗温] [main] [平静]: "这里今晚缺一个修窑门的人，也有一间空客房。你要工作，我可以介绍；你只想看看，我也不替你解释。"\n[map_update: new_location="远灯研修院" connected_to="月线车厢" detail="成年人学习手艺与实用魔法的夜间工坊"]\n[clock: value="第一晚 · 20:18"]\n[choices: "请罗温介绍修窑门的工作"|"自己参观还亮着灯的工坊"|"告诉罗温今晚只想找房间休息"]`
    : `The train stops at Far Lantern. You cross the short platform into a well-lit stone courtyard. Open workshops hold pottery wheels, repair benches, and observatory instruments. There are no uniforms and no children.\n\nRowan has removed his steward’s cap, but the narrow glasses and silver ticket clip still make him easy to recognize. He gives the map to the potter on night duty without deciding whether you should stay.\n\n[Rowan Hale] [main] [quiet]: "They need someone to repair a kiln door tonight, and one guest room is empty. I can introduce you to the work. If you only want to look around, I won’t explain the place for you."\n[map_update: new_location="Far Lantern Institute" connected_to="Moonline Carriage" detail="Night workshops where adults study trades and practical magic"]\n[clock: value="First evening · 20:18"]\n[choices: "Ask Rowan to introduce the kiln-door job"|"Visit the workshops that are still open"|"Tell Rowan you only need a room tonight"]`

  const celesteDebutBase = zh
    ? `你循着喊声穿过雨棚。一个二十六岁的女人正用肩膀顶住黑色琴箱，腾出手指挥别人搬木箱。她留着赤褐色侧辫，右耳扣着一枚黄铜耳扣，陶红披肩被雨打湿了一角。\n\n舞台边的结算夹上写着“塞莱斯特·阿尔丹”。她看到你先扶住最重的箱子，才把另一端交到你手里。\n\n[塞莱斯特] [main] [利落]: "把这三只木箱放到干燥处，七枚钱币。黑色琴箱别碰锁扣——里面的东西比我今晚赚的都贵。"\n\n你和她把三只木箱搬过积水，依次放到干燥台面。最后一只落稳后，塞莱斯特当场数给你七枚钱币。\n[character_update: character_id="celeste-ardin" character="塞莱斯特" role="26 岁 · 夜市乐师与临时雇主" detail="在杯影夜市抢救被雨淋湿的舞台器材" vitality="77" stress="38"]\n[widget: coin, add: 7]\n[map_update: new_location="杯影夜市" connected_to="灯湾码头" detail="雨棚下的演出摊位和临时工作区"]\n[choices: "帮塞莱斯特把折叠椅也摆好"|"收好钱币，离开舞台"|"问她演出为什么突然停了"]`
    : `You follow the shout beneath the market awnings. A twenty-six-year-old woman braces a black instrument case with one shoulder while directing the wooden stage cases with her free hand. She wears her auburn hair in a side braid, a single brass cuff on her right ear, and a terracotta shawl darkened by rain at one corner.\n\nThe payment board beside the stage reads “Celeste Ardin.” She waits until you take the heavier end before giving you the other handle.\n\n[Celeste Ardin] [main] [brisk]: "Three wooden cases to the dry platform, 7 coin. Leave the latch on the black case alone. What’s inside costs more than I’ll make tonight."\n\nTogether you carry all three wooden cases across the wet aisle and set them on the dry platform. When the last case is secure, Celeste counts out 7 coin on the spot.\n[character_update: character_id="celeste-ardin" character="Celeste Ardin" role="Age 26 · night-market musician and occasional employer" detail="Saving rain-soaked stage equipment at Cupshadow Market" vitality="77" stress="38"]\n[widget: coin, add: 7]\n[map_update: new_location="Cupshadow Market" connected_to="Lantern Quay" detail="Performance stalls and temporary work beneath rain awnings"]\n[choices: "Help Celeste arrange the folding chairs"|"Pocket the coin and leave the stage"|"Ask why the performance stopped"]`

  const celesteDebut = zh
    ? celesteDebutBase.replace('腾出手指挥别人搬木箱。', '腾出手指挥别人搬木箱。舞台旁还叠着一排没有摆开的折叠椅。')
    : celesteDebutBase.replace('with her free hand.', 'with her free hand. A row of folded chairs is still stacked beside the stage.')

  const celesteDebutContract = celesteDebut.replace(
    '[widget: coin, add: 7]',
    zh
      ? '[job: action="offer" id="celeste-opening-stage-cases" label="把三只舞台木箱搬到干燥处" employer="塞莱斯特" wage="7"]\n[job: action="settle" id="celeste-opening-stage-cases"]'
      : '[job: action="offer" id="celeste-opening-stage-cases" label="Move three stage cases to the dry platform" employer="Celeste Ardin" wage="7"]\n[job: action="settle" id="celeste-opening-stage-cases"]',
  )

  const celesteWorkBase = zh
    ? `你把椅子摆成半圆，特意给湿透的过道留出一条宽路。塞莱斯特走上台试了几步，鞋跟没有再碰到箱角。\n\n她打开琴箱，里面是一把没有琴弓的低音乐器。今晚的弓断了，真正的演出得等到潮汐群岛；那里有个修弓的人，也有她答应过的一场清晨演出。\n\n[塞莱斯特] [main] [打量]: "你会留路给别人走，这比搬得快少见。我要赶末班车。你可以同行，但我不会因为你帮过忙，就替你付下一程。"\n[reputation: npc="塞莱斯特" action="trusted"]\n[choices: "和塞莱斯特搭月线去潮汐群岛"|"留在夜市找其他演出工作"|"先问清群岛清晨的工作报酬"]`
    : `You set the chairs in a half circle and leave a wide path through the wet aisle. Celeste crosses the stage twice; her heel no longer catches a case corner.\n\nShe opens the black case. Inside is a low-voiced instrument with no bow. Tonight’s bow snapped, and the real performance must wait for the Tidal Islands, where a bow maker—and a promised dawn concert—are waiting.\n\n[Celeste Ardin] [main] [appraising]: "You leave room for other people to move. That is rarer than speed. I’m catching the last train. You may come, but one favor doesn’t make me responsible for your next fare."\n[reputation: npc="Celeste Ardin" action="trusted"]\n[choices: "Take the Moonline to the Tidal Islands with Celeste"|"Stay at the market and find other stage work"|"Ask what the dawn job on the islands pays"]`

  const celesteWork = zh
    ? celesteWorkBase.replace('和塞莱斯特搭月线去潮汐群岛', '和塞莱斯特去潮汐群岛')
    : celesteWorkBase

  const celesteTransit = zh
    ? `塞莱斯特锁好琴箱，你们从夜市旁的小站上车。她把琴箱放在自己座位边，没有让它占掉另一张椅子。\n\n列车离开灯湾后，窗外的房屋越来越少，潮水在月光下露出一段段沙洲。清晨演出和你到群岛后自己找工作的打算，都要等列车到站。\n\n[clock: value="第一晚 · 20:04"]\n[map_update: new_location="月线车厢" connected_to="杯影夜市" detail="沿海堤驶向潮汐群岛的夜班车"]\n[choices: "问塞莱斯特那场清晨演出唱给谁听"|"在车厢里闭眼休息"|"到群岛后自己先找工作"]`
    : `Celeste locks the instrument case, and you board at the small station beside the market. She keeps the case beside her own seat rather than taking the empty chair.\n\nAs the train leaves Lantern Quay, houses grow sparse and long sandbars appear in the moonlit tide. The dawn concert and your own search for work will both wait until you reach the Tidal Islands.\n\n[clock: value="First evening · 20:04"]\n[map_update: new_location="Moonline Carriage" connected_to="Cupshadow Market" detail="A night train following the sea wall toward the Tidal Islands"]\n[choices: "Ask who the dawn concert is for"|"Close your eyes and rest in the carriage"|"Look for your own work after reaching the islands"]`

  const celesteReunionBase = zh
    ? `天亮前，月线在潮汐群岛的木栈桥旁停下。退潮露出大片浅滩，渔网挂在栏杆上晾着，远处的修理铺已经生火。\n\n塞莱斯特站在桥头，赤褐侧辫、右耳黄铜耳扣和陶红披肩都没有变。她把修好的琴弓搭在琴箱上，却没有催你跟上。\n\n[塞莱斯特] [main] [轻松]: "演出还有一小时。你可以帮我试场，也可以去码头接自己的活。同行不等于整晚都要走同一条路。"\n[map_update: new_location="潮汐群岛" connected_to="月线车厢" detail="退潮时由木栈桥相连的渔业与修理聚落"]\n[clock: value="第 2 天 · 05:32"]\n[choices: "帮塞莱斯特检查清晨演出场地"|"去码头找修网的短工"|"独自沿退潮后的浅滩走走"]`
    : `Before dawn, the Moonline stops beside the wooden bridges of the Tidal Islands. Low tide has exposed broad flats, nets dry on the rails, and a repair shed already has its stove lit.\n\nCeleste waits at the bridgehead. The auburn side braid, brass ear cuff, and terracotta shawl have not changed. She rests the repaired bow across the case without hurrying you after her.\n\n[Celeste Ardin] [main] [easy]: "The concert starts in an hour. You can help me test the space, or take your own job at the landing. Traveling together doesn’t mean choosing the same road all night."\n[map_update: new_location="Tidal Islands" connected_to="Moonline Carriage" detail="Fishing and repair settlements linked by bridges at low tide"]\n[clock: value="Day 2 · 05:32"]\n[choices: "Help Celeste check the dawn performance space"|"Take a net-mending job at the landing"|"Walk the exposed tide flats alone"]`

  const celesteReunion = zh
    ? celesteReunionBase.replace('帮塞莱斯特检查清晨演出场地', '帮塞莱斯特试场')
    : celesteReunionBase

  return [
    { match: zh ? ['乘务员', '夜班工作', '夜班'] : ['steward', 'night shift', 'vacant'], content: rowanDebutContract, imagePrompt: 'Lantern Quay railway platform at blue hour, Rowan Hale sorting blank colored route cards beside an open route case and a rain-damaged map, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'rowan-hale' },
    { match: zh ? ['地图压平', '泡皱', '地图'] : ['flatten', 'buckled map', 'mend paper'], content: rowanWork },
    { match: zh ? ['送去远灯', '罗温把地图', '远灯研修院'] : ['deliver the map', 'with Rowan', 'Far Lantern'], content: rowanTransit, imagePrompt: 'inside a warm Moonline carriage leaving Lantern Quay, waterproof map tube and route case beside two separate seats, environmental transition, no clear faces, no text, no UI, 4:3', imageSubject: 'environment' },
    { match: zh ? ['缺失的海岸线', '到站后', '研修院'] : ['missing stretch', 'train arrives', 'Institute'], content: rowanReunion, imagePrompt: 'Far Lantern Institute adult workshop courtyard at night, Rowan Hale delivering a waterproof map tube beside pottery and repair workshops, one dominant adult identity, no uniforms, no minors, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'rowan-hale' },
    { match: zh ? ['夜市帮忙', '搬箱子', '夜市'] : ['move cases', 'night market', 'cases at the market'], content: celesteDebutContract, imagePrompt: 'Cupshadow night market after rain, Celeste Ardin bracing one black instrument case while directing plain wooden stage cases beneath canvas awnings, one dominant adult identity, no duplicate instrument case, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'celeste-ardin' },
    { match: zh ? ['折叠椅', '摆好', '演出停'] : ['folding chairs', 'performance stopped', 'arrange'], content: celesteWork },
    { match: zh ? ['去潮汐群岛', '和塞莱斯特去', '清晨的工作'] : ['Tidal Islands with Celeste', 'dawn job', 'Take the Moonline'], content: celesteTransit, imagePrompt: 'inside a Moonline carriage along the moonlit sea wall, one closed black instrument case beside a seat and tidal sandbars outside, environmental transition, no clear faces, no text, no UI, 4:3', imageSubject: 'environment' },
    { match: zh ? ['清晨演出', '群岛后', '唱给谁'] : ['dawn concert', 'reaching the islands', 'concert is for'], content: celesteReunion, imagePrompt: 'Tidal Islands before dawn, Celeste Ardin at a wooden bridgehead with one closed instrument case and repaired bow, fishing nets and repair sheds behind her, one dominant adult identity, no readable text, no UI, 4:3', imageSubject: 'others', imageCharacterId: 'celeste-ardin' },
  ]
}
