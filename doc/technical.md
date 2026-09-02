# 技术文档

## 1. 技术栈

- React 18 + TypeScript + Less 构建界面与游戏状态层。
- Vite 5 负责开发和生产构建，`base: './'`，产物位于 `dist/`，可部署到任意子路径。
- 叙事正文使用响应式 DOM 累积阅读；事件图片由 AlterU Media Service 生成并嵌入对应回合，不使用 ImageGen。
- Aigram 平台调用通过宿主桥接适配；demo 模式用本地已编排回合验证完整体验，remote/Aigram 模式共享同一协议解析和权威 reducer。
- 游戏永久 UUID 为 `66263f04-c6a5-4290-85f2-1011bbccf697`。浏览器存储经 `alteru-storage-scope.js` 按当前部署 session 隔离。

## 2. 目录结构

```text
src/
  game-id.ts                         # 可由 Remix 替换的游戏 UUID
  shared/runtime/                    # Aigram bridge、Media Service 客户端与图片 hook
  shared/save/useGameSave.ts         # 平台存档和本地镜像
  story/StoryShell.tsx               # 入口、阅读流、选择、抽屉与详情界面
  story/story.less                   # 编辑水粉配套的 wayfarer UI 与响应式规则
  story/cartridges/wanderlight.ts    # 双语世界、十二区域整合、领域规则和图片导演参数
  story/cartridges/wanderlightWorldExpansion.ts # 五个新区域、五名预设角色、抵达入口、重逢与跨区导演规则
  story/cartridges/wanderlightPresetEvents.ts # 12 地点 × 4 条双语预设事件及具体后续行动
  story/cartridges/wanderlightV1Content.ts   # 罗温/塞莱斯特的首次登场、工作、中转与重逢
  story/cartridges/wanderlightV1Outcomes.ts  # 三名核心角色的边界判断、同行与自然停止点
  story/engine/                      # 协议、reducer、领域规则、危险、连续性与图片导演
    presetEventDirector.ts           # 空闲时的确定性事件轮换、选择解析与使用记录
    turnPipeline.ts                  # 支付/地点/图片/选项共享的生成回合提交边界
    paymentConsistency.ts            # 工作合同、付款正文/命令一致性门禁与已知旧档修复
    turnConsistency.ts               # 场景、目标、选项、配图原子一致性门禁与已知场景旧档修复
  story/engine/choiceInput.ts        # 正文选择记录编解码与 1/01/2/02 数字输入映射
  story/engine/readingAnchor.ts      # 续玩时定位最近行动与剧情上下文，避开底部排版缓冲
  story/adapters/                    # demo、Aigram、remote 三种叙事来源
  story/narrativeStyle.ts            # 中英文“清楚但有质感”生成合同
  story/audio/                       # 程序化环境与反馈音
  story/img/worlds/                  # 入口/海报正式资产
public/
  alteru-storage-scope.js            # session 级浏览器存储适配器
  poster.png                         # 英文入口海报
doc/                                 # 需求、视觉、技术、界面与媒体评审文档
public-tests/
  protocol-security.ts               # 可公开的协议边界与恶意输入回归
  choice-contract.ts                 # 正文、行动票和数字输入同源回归
  reading-anchor.ts                  # 续玩恢复点不落入底部空白的回归
  audio-synth.ts                     # 程序化音频与事件路由回归
  world-expansion.ts                 # 12 地图/8 角色/双语旅行/首次登场与重逢回归
  preset-events.ts                   # 48 事件、轮换持久化、目标/危险优先级和第一人称图片回归
```

## 3. 核心模块

### 状态、协议与回合

`useStoryEngine.ts` 负责读取 cartridge、提交玩家动作和调用适配器；生成结果统一先进入 `engine/turnPipeline.ts`，按同一份提交前存档依次完成支付规范化、地点/图片/选项规范化、机械校验与提交判定，只有通过后才一次性交给 `engine/reducer.ts`。人物、地图节点、具体场景、关系、物品、数值、工作合同、危险阶段、图片块和选择都属于 `StorySave` 权威状态；模型正文不能直接绕过 reducer 改写存档。`protocol.ts` 同时兼容标准 `[command: ...]` 与模型偶发的 `[command key="..."]` 缺冒号属性格式，机器协议不会进入可见正文；存档规范化也会移除旧版本已经泄漏的完整协议块。`engine/domainRules.ts` 权威结算短工、餐食、普通/现场休息、公共休息处撤退、住宿、车厢休息、泛化消费澄清和十一条普通车票路线，并用 `clock-add` 保持跨日时间。五个新增目的地使用 `replace` 原子安装三条地区专属入口，其余旅行继续 `derive`；reducer 将受信任的本地 `successChoices` 与作者级确定性人物入口保留下来，不再被通用词面过滤器误删。每条规则声明 `successContinuation / rejectionContinuation`：`resume` 保留原 `decisionContext` 并让 reducer 重新校验未执行的兄弟选项，`derive` 从权威新状态派生后续，`checkpoint` 进入停止点，旧规则才默认 `replace`。因此领域动作不再无条件安装一套全局选项。地图节点的 `capabilities` 是短工、热饭与住宿的执行前置条件，月线车厢只有 `carriage-rest`，错误自由输入会零效果拒绝并继续原线程。`repairLegacyDomainChoiceReset()` 识别旧固定菜单，从前一场不可变 choice record 恢复仍合法分支，并同步修复当前记录；标记保证二次载入不重复迁移。接受与拒绝的本地行动都写入可读 `narration`，接受结果先于数值条，拒绝结果不安排场景图。短工使用 `repeatPolicy: location-day` 写入地点/日期作用域标记；`repairDomainRepeatState()` 把旧档最新已完成短工迁移为已结算。`rest-commitment` 区分真正休息与询价/问路，`dangerPolicy` 决定恢复回合禁止同回合危险、或在撤退时原子结束当前威胁。`engine/continuity.ts` 为跨地区旅行补充月线中转，但不会重复已经由正文亲历的车厢场景。

`engine/executeTurn.ts` 是与 React/DOM/媒体/存储解耦的服务端回合权威边界，并保留活跃危险 deflection、领域事务、作者回合、proposal 校验与 reducer 的原顺序。`_qa/server-turn-pipeline.ts` 验证模型旁路、原子提交、输入不变性和危险线程保护。当前仅为源码 canary，正式 Story Session 写入仍等待后端可验证的 AlterU 玩家身份。

动态有偿工作使用 `[job]` 协议：`offer` 固化稳定工作 ID、雇主、工作内容和明确工资，`settle` 只能结算未完成合同，并由 reducer 直接按记录工资增加钱币和 `jobs_completed`；同回合额外的 coin widget 会被拒绝且 reducer 也做去重防御。罗温和塞莱斯特的开局即时短工同样使用稳定 `offer → settle`，不再靠正文旁的裸加币命令；“拿短工报酬后留在码头”也会先完成装货、按原合同结算八枚钱币，再保留在码头。`paymentConsistency.ts` 在任何生成正文写入存档前机械核对钱币、铜板、铜币、硬币等报价、付款、消费和合同金额；它还把报酬、工钱、薪水、工资、pay、wages、salary、compensation 与玩家赚得/收到/领到/被交付的组合识别为完成付款，即使句中没有币种词也必须具有可见精确金额和结算指令。明确否定句、未来领取/仍待结算的计划与 NPC 自己领工资不算玩家收入；`will pay` 是报价承诺，`hands you / received` 才是已发生转账，英文条件词使用完整词边界，避免把 `shift` 内的 `if` 误判成付款承诺。旧存档若最近回合已经写成完成付款，只在唯一未结合同能提供精确工资且该回合没有加币记录时补账并结清；没有合同或多个合同时不猜金额。消费侧继续用当前玩家行动做授权门禁：询价、寻找和考虑不是付款同意；“把钱全部花完”没有购买对象，也不是交易授权，Cartridge 的精确领域规则会解释余额未变并要求选择具体商品或服务。未经授权的消费正文、正文声称花光但没有合法事务、隐藏扣款均拒绝；“你用这枚硬币支付”会识别为一枚支出，正向 coin widget 会被判为方向冲突。明确订房由 `overnight-room` 领域规则原子完成余额门禁、扣 `10` 枚、写入 `lodging_secured` 与结束当晚，英文 `stay overnight / pay for the room` 同样先进入本地预检而不落给模型。钱币达到 `10` 时目标自动从挣钱推进为住宿/工作/搭车决策，未订房又降到 `9` 以下时退回挣钱。首次一致性失败会要求当前适配器完整重写同一回合，第二次仍失败则不提交。

每个非 demo 生成回合还必须输出唯一 `[scene_location]`；正文跨地图节点抵达必须同回合输出 `[map_update]`，明确接受或被交付一项新任务时必须输出 `[state]`，场景图必须用 `[image_location]` 声明与 `scene_location` 完全相同的具体场景。`StorySave.location` 保存权威地图节点，`sceneLocation` 保存旅店、工坊、田舍等当前具体场景；旧存档缺少后者时回退到地图节点。地图节点的双语 `routeHints` 提供稳定语义指纹；动态地点的 `[map_update]` 额外接受稳定 `location_id` 与管道分隔的 `route_hints`。reducer 只保留正文、地图公开描述或玩家明确命名动作已经证明的别名，丢弃隐藏/泛化别名，并把后续别名合并到同一 ID；缺少模型 ID 时按规范化地点名生成确定性后备 ID。旧动态存档补入规范地点名，只在最近可见历史同时证明父地点和当前子地点时恢复该子地点别名。`turnConsistency.ts` 的 `inferActionDestination()` 要求行动同时具备移动/承诺动词和唯一非当前节点指纹，因而可把“往田野深处检查藤架”解析到 `silverleaf-vineyard`，但不会因在车厢里讨论田野而传送；别名分数并列或一个既有 ID 被用于不同规范地点名时拒绝。`canonicalizeTurnMetadata()` 用唯一目的地补齐遗漏的 `map_update`，替换旧地点的 `scene_location`，并允许“田野深处”等节点内细分地点继续作为具体场景。模型明确声称玩家仍在旧地点时不静默改写，而是进入修复。模型缺少地点绑定或只把图片绑到父级地图的提议会被丢弃并交由本地图片导演重建；可信作者图可在本地绑定当前具体场景。

真正的状态冲突会触发一次完整重写；重写仍不一致时，普通未知行动由 `applyConsistencyRecovery()` 拒绝不可靠内容、保持地点/目标/数值/物品/关系不变，并把未经证明的失败行动写入 `lastActionId` 与隔离事实。每轮合法选择在 reducer 提交后由 `bindChoiceDestinations()` 预解析；可确定路线保存 `targetLocationId`，重载时重新绑定。刚点击的系统跨地点按钮优先读取这个稳定 ID，再回退到实时语义推断；若模型和一次修复仍失败，`applyDisplayedRouteFallback()` 只提交本地确定的 `map_update + scene_location`，用统一 transition/effect 记录抵达，并从新地点生成可执行选择，不再退回“仍在旧地点”。如果唯一问题是 `turn.requires_actionable_choices`，`turnPipeline` 允许提交已经合法发生的正文与状态。`deriveReplylessChoices()` 在普通同地图回合才考虑仍有依据且未刚执行的旧 sibling；一旦 `danger.phase` 不为 `calm`，旧选项完全失去兜底资格，改由 `contextualDangerChoiceLabels()` 把当前 `currentThreat` 写入确认、直接应对与撤离按钮。`createRecoveryChoices()` 使用同一具体危险文案；无危险且存在当前目标时只返回目标本身；目标、等待回应、未完成工作和危险都不存在时优先返回当前地点的具体预设事件，只有事件池也不可用才退回“观察当前地点的新变化”。它不再加入可能跳走现场的泛化同行讨论。`repairLegacyObjectiveRecoveryChoices()` 在载入时同步改写旧版抽象目标按钮、旧“目标 + 观察 + 商量”组合和当前 scene 的 choice record，迁移幂等。自由输入仍开放，也不为补数量创造新实体。支付、地点、任务、图片或其他状态问题绝不走这条旁路。`repairLegacyConsistencyRecovery()` 同步改写旧正文、文章选项和底部选项；`restoreDeterministicRecoveryChoice()` 进一步识别后来已经由确定性规则或唯一语义目的地证明可执行的旧失败行动，将其作为精确本地路线恢复。

`canonicalizeTurnMetadata()` 还会在回合提交前逐项处理选择：先删除“商量怎么办、观察变化、等待、换个办法”等生成式占位按钮，以及与本回合玩家行动相同或只增加“继续 / 再次 / retry / resume”前缀的即时重复，再删除不能在新场景中直接行动的旧地点选项，并用 `filterGroundedChoices()` 检查当回合正文与权威人物、地图详情、物品、活动工作和数值定义。中文先拆分稳定实体，把普通提问/动作修饰语排除，再要求剩余复合词能分解成各自至少两个字、且来自单条可见正文或权威状态的片段；英文同样把动作动词与具体名词分开，禁止凭同义动作词误删“货箱 / 仓门”等已经可见的真实对象。访问过的 `routeHints` 只给移动动词提供路线依据；非移动选项若引用该别名，还必须在当前 `sceneLocation` 或本轮可见正文中出现，避免把“知道一个地方”误判为“当前能在那里做任意事情”。匹配 Cartridge 领域规则的选项不再用正文词面放行：只有 `resolveDomainAction()` 返回 `accepted` 才保留，`rejected` 在显示前删除。过滤是逐项而不是整组否决；剩下 `1–5` 项都可直接提交和渲染。

`authoredTurns.ts` 将当前仍显示且玩家仍在开局地图节点的固定 choice 映射到 `opening.deterministicTurns`；因此先询价或观察后，未领取的三条开局工作仍由本地固定路线执行，不再受 `scene === 0` 限制。`deterministicChoiceTurns` 处理后续已经成立的合同、固定同行、主路线节点和作者支线按钮；它必须同时精确匹配当前可见按钮，并满足声明的地点、稳定人物和工作状态。`public-tests/deterministic-choice-turns.ts` 枚举作者选项图，要求每个固定系统按钮都能在其声明状态下解析到本地执行者；新增按钮若没有 owner 会直接令聚合测试失败。所有系统按钮仍经过统一支付/地点/选项校验；相似自由输入不会被关键词误捕，继续调用 Adapter。

十二个地图节点分别保存至少四类本地事实：工作、日常社交、环境变化与跨区线索；这些事实进入 Aigram 世界上下文，防止自由生成把所有地点写成同一套活动。`wanderlightWorldExpansion.ts` 还把五名未来预设人物的稳定 ID/地区绑定和五类跨区域线索写入幕后导演合同，但角色姓名不会进入玩家开场、地图或初始 `StorySave`。抵达后的首条人物入口由 `deterministicChoiceTurns` 在本地完成合法首次登场；存档已有同 ID 时，匹配顺序改用重逢回合，避免重复自我介绍。危险池从四项扩到十项，覆盖信号、潮闸、热水、蓄雨渠、授粉灯和邮袋冲突。`dangerDirector.threatLocations` 把八项地区威胁限制到各自地图节点，只有末班月线取消与私人邀请泄露保留为全局威胁。危险导演为仍处于 `calm` 的新存档保留六个完整场景的首轮宽限；平静状态的作者确定性回合拥有当前节拍，不再叠加随机危险。正文一旦已经建立袭击、营救、追赶、闯入或正面对峙，`turnConsistency.ts` 要求同回合提交 `encounter`，危险状态会立即越过宽限。新调度的危险还必须同时满足可见正文包含该具体威胁、`encounter.kind` 与调度名称完全一致、阶段一致，且警告/对峙选项逐条指向该威胁。若正文已经明确建立当前调度威胁、但模型漏写或写坏 `encounter / choices`，`canonicalizeVisibleDangerDirective()` 只用本地权威值修复这两类元数据；正文没有出现威胁或已经进入结算阶段时绝不合成。其余不一致由统一管线要求重写；唯一一次修复仍失败且存在 `dangerDirective` 时，`createDangerFallbackScene()` 以相同威胁、阶段和本地检定结果提交确定性场景，优先于 `applyConsistencyRecovery()`，因此不会回到通用菜单。`repairLegacyDangerLoopChoices()` 只迁移当前场景确有恢复块或旧通用菜单的活动危险存档，并同步不可变选择记录。后续任何未结算回合都必须在正文和命令里保留同一威胁，商量、观察、询问、等待或计划都不构成自动解除；只有可见正文明确解释结局并提交 `resolution` 才能关闭。活动危险同时阻止普通短工和跨地区旅行，失败修复也不能用本地路线兜底瞬移离场；完全不指向当前威胁的自由输入由 `resolveActiveDangerDeflection()` 在模型调用前给出具体原因，原子保持地点、目标、数值和危险阶段，并禁止拒绝回合生成图片。玩家明确回应威胁时仍由正常叙事链路裁决。模型丢失全部合法危险选项时，reducer 使用 Cartridge 配置的方法生成带当前具体威胁的现场按钮；按钮文案不嵌套引号，保证 `[choices]` 协议可以完整解析。`repairLegacyDangerMethodChoices()` 会同步替换旧存档中尚未执行的旧文案及当前正文选项记录，但不改写历史行动。`test:danger-loop` 覆盖连续两次不合格、确定性推进、结算离开危险、旧档迁移与作者选项保护。

`wanderlightPresetEvents.ts` 为每个地图节点提供四条作者级双语事件，共 `48` 条，覆盖本地工作、日常生活、环境变化、来访者与跨区线索。`presetEventDirector.ts` 只在没有当前目标、没有等待回应的 `decisionContext`、没有未完成工作合同、没有待解决危险且没有更高优先级确定性回合时提供系统兜底；它先读取可见 `save.location`，再回退地图当前标记，以免旧档地点标记短暂不同步。轮换以地点、日期、周期和已使用次数确定，不重复紧邻事件，并把 `preset_event:last`、日期、分类和每条次数写入 `StorySave.facts`。因此通用“观察新变化”只保留为没有任何合格事件时的最后兜底；正常按钮直接写出正在发生的具体事情。玩家仍可用自由输入主动查看当地动静，但系统不会用随机事件按钮覆盖正在进行的目标、回应、工作或危险线程。

`mergeAuthoredMapNodes()` 在载入时以稳定 ID 合并 Cartridge 新增地图：保留旧存档的访问状态、动态地点和当前节点，补入缺失的作者节点并标记为未访问。迁移重复执行不会新增重复节点或改变已保存路线，因此现有七节点存档不需要重开即可获得五个新增目的地。

### 角色视觉身份与图片生成

每个长期角色用稳定 ID 关联 `CharacterVisualIdentity`。权威存档保存身份状态、版本、`anchorTaskId`、不可变特征、服装语言和禁止漂移项，不持久化服务的临时图片 URL。原有三名开场角色指向已审核锚点任务；五名新增预设角色拥有作者级完整身份合同，在首次可见登场后与动态角色一样调用一次 `text` 生成 `512×640` 单人锚点，成功后保存任务 ID，再从锚点图片以单参考 `edit` 生成剧情动作图。

`engine/characterContinuity.ts` 在统一回合管线和 reducer 两层执行人物门禁。新动态角色必须同时满足：正文先出现可辨认形态或动作、正文给出日常名字来源、名字之后出现当前意图或互动、协议提供合法稳定 ID、英文外貌合同和至少一项不可变特征。`character_update` 不能让已有 ID 改名，也不能把已有姓名绑定到另一个 ID；`party_change add` 只能引用已经固化的人物，并要求正文明确同行；关系命令不能顺带创造陌生人。管线层将违规草稿送去一次修复，reducer 层即使在 demo 或直接调用时也拒绝写入。

`shared/runtime/media.ts` 实现自有服务请求、尺寸适配、任务轮询、结构化错误与可重试信息。网络结果不明确时，同一次生成的重试复用同一个 `request_id`，避免重复任务；明确的新锚点与新场景使用新的 UUID。浏览器媒体回归会拦截公开服务合同，验证首次动态角色依次发送 `text` 锚点与单参考 `edit` 场景请求，刷新后只解析已保存的 `anchorTaskId` 并再次发送同参考 `edit`，同时确认任何临时 URL 都没有进入人物存档。当前服务只允许单参考，所以一张图只有一个视觉身份所有者；双人关系用视点、肩后、背影、剪影或正反打表达。

人物详情公开显示 `queued / generating / anchored / failed / unanchored` 的视觉身份状态。锚点失败不阻塞文字叙事，但在成功重试前不会继续生成该角色的无参考清晰面孔。领域规则触发的旅行会被 reducer 合成为图片导演可读的 `map_update`，因此即使没有模型图片提示，也会为首次抵达安排地点空镜；地点的工作、社交与休息事实会进入构图提示，且开场行李、种荚和雨街残留由图片导演拒绝。

`imageDirector.ts` 的兜底节奏为连续 `2` 个有效回合没有新图即补图；地点变化、关系转折和任何说话者的重要对白可立即触发。重要性根据对白是否揭示关键事实、改变关系、设定边界、作出承诺/请求、警告危险、建立任务或形成明显情绪转折判定；适配器还可用 `[dialogue_focus]` 明确说话者与可见表情。对白镜头不依赖有限情绪词，也不受普通配图节流限制，并优先于模型提出的普通环境图。已有 `visualIdentity` 的说话者从稳定人物 ID 取得锚点；动态未锚定人物不会借用其他身份，但仍使用中近景反应镜头并保留当前地点背景。

图片提示协议版本为 `7`。导演不再因为正文使用第二人称“你”就判定主角可见；只有明确的视觉主体声明才能让主角进入画面。普通观察、人物递物、重要对白、桌面/门窗/物件和环境变化优先或按稳定散列选用 `first-person`，地点初见保持建立镜头，必须看见主角完整动作或空间关系时才使用第三人称。第一人称提示明确规定相机是玩家眼睛，禁止主角脸、头、背、肩、轮廓、倒影和越肩构图，正文未证明时也禁止补手；对应图片块持久化 `perspective: first-person` 与 `playerVisible: false`，媒体请求固定为 `text` 且 `reference_urls` 为空。重要对白用主角位置的现场中近景观察对方表情，不再自动变成人物脱离环境的证件照。`engine/itemImage.ts` 独立构造行囊图鉴 prompt；`ITEM_IMAGE_STYLE_VERSION=3` 会让旧写实缓存失效并在再次打开行囊时重新排队。内部媒体 QA 已验证编辑水粉、无文字、第一人称物件镜头与准确三枚印章；公开文档不记录过程任务 ID。

### 屏幕适配与交互

顶部手册入口使用原有笔记本图标，不渲染可见文字，并与文字大小、声音控件复用相同的 44px 图标按钮布局；点击后默认直达 `party` 数据页。抽屉内四个栏目图标统一为 `24×24`、`1.7px` 圆角描边，并分别用人物连接、折叠节点路线、带扣旅行包和装订手册表达。人物关系页在列表前渲染关系总览，并把玩家自身状态移至列表末尾，避免遮挡关系内容。人物行从 `StorySave.relationships` 聚合关系印象和共同经历数，人物详情首屏使用高对比关系摘要，完整事件仍读取同一权威数组，不维护第二份关系状态。

界面采用累积阅读流，事件图片留在它所属的回合中。`protocol.ts` 即使同时收到正文项目符号和结构化 `[choices]`，也会提取并删除正文里的重复列表，并让玩家已经看见的尾部行动成为该回合权威选项；模型适配器同时禁止重复输出两套选项。reducer 将最终选项编码为 `choices-<scene>` 阅读块，因此正文从 `01` 起的连续编号记录和底部行动票始终来自同一数据。`choiceInput.ts` 把输入框中的普通或补零数字映射到当前同号选项，其他内容继续作为自由行动。`readingAnchor.ts` 从权威阅读块中寻找最近一轮玩家行动；继续存档和“有新内容”都滚到这个可读锚点，而不是包含 `60dvh` 排版缓冲的物理底部。窄屏通过内部布局适配，不使用整页缩放；底部选择使用 `onClick`，触控目标至少 `44×44px`。入口和平台内主构图不为外部访客栏预留永久空间。

顶部工具由 `Icons.tsx` 的同一套 `24×24 / 1.7px` 线性 SVG 驱动，文字、声音和旅途手册共享等宽分段控件。HUD 使用浅色票券网格；精力、风闻保留进度轨，钱币只显示余额。`HeaderStat` 在值变化时同时保留旧值和新值，以方向相反的双层滚动交代前后关系，并显示 `+N / −N`；`prefers-reduced-motion` 下取消位移但保留静态变化量。点击任一 HUD 数值会打开对应玩家状态卡；三项 `StatDefinition.description` 分别说明它代表什么、如何变化和阈值影响。旅途手册默认进入人物列表。`CharacterPortrait` 通过角色持久化的 `anchorTaskId` 解析身份锚点 URL，并用模块级 Promise 缓存避免重复任务查询；同一图分别用于对话小头像、人物列表缩略图和详情竖幅大图，没有可用锚点时退回首字母。人物列表同时把关系事件汇总成“初识 / 熟悉 / 信任 / 默契 / 戒备”与共同经历数，人物详情仍展示事件来源；这不是公开好感度分数。

`StatDefinition.floorRule` 是数值归零的权威门禁，但恢复规则从 `0–100` 任意精力值都可执行。`resolveDomainAction()` 在调用模型前把“去屋里休息、选择休息、小睡”等中英文明确行动归入本地普通休息，同时排除询问位置、房价和可用性的非授权表达。普通休息只从当前 map node 已登记的 `routeHints` 识别具体场景，只从存档中已认识且未离开的角色识别同行者；命中后把场景写入 `DomainActionResolution.sceneLocation`，以人物 + 地点生成确定性结果和第一条直接后续，再合并仍有效的原兄弟选项。这样“和媛夕去蒸汽露台休息”会保留媛夕、蒸汽露台和原剧情，不会被压扁成“原地坐下”。`applyParsedScene()` 在数值首次触底的同一回合写入世界内解释并替换底部选项；`normalizeSave()` 对已经保存的精力 `0` 旧档执行同样迁移。普通休息 `+8`、公共休息处 `+16`、热饭 `+12`、客房 `+28`、整夜 `+36` 和车厢 `+8` 都由 domain rules 原子结算；包含 `session ended=true` 的整夜休息和住宿会在同一 reducer 事务中清空普通选项，使 Composer 只提供单一“继续漫游”停点，避免日终后仍循环吃饭、休息、短工或再次结束当天。`repairEndedSessionChoices()` 在载入上一版已经保存成“日终 + 普通选项”的旧档时移除 live choices 与对应正文记录，因此玩家无需重开存档。`domainMaxDelta=36` 只放宽可信本地交易，模型 widget 仍受 `maxDelta=24` 限制。危险未解除时普通恢复被原子拒绝；公共休息处撤退追加权威 `danger` 效果。`useStoryEngine()` 与 reducer 双层调用 `domainSuppressesDanger()`，防止外部或旧调用方把随机失败扣除叠加到已接受的休息回合。

### 行动权威影子试点

`domainRules.authorityMode` 当前设为 `shadow`。已登记的工作、进食、住宿、休息和旅行规则可以由 `enumerateRecommendedDomainChoices()` 从当前权威状态枚举；重复结算、地点能力不符、数值不足或活跃危险下不成立的规则不会进入候选。`auditDomainChoiceAuthority()` 同时把现有模型推荐分类为可执行领域行动、已失效领域行动或开放叙事行动，但 `shadow` 不替换、不排序也不删除玩家看到的选项。

只有 QA URL 带 `?authority_shadow=1` 时，`authorityShadow.ts` 才把最近 100 个样本留在当前页面内存的 `window.__WANDERLIGHT_AUTHORITY_SHADOW__`；样本不写入游戏存档、不上传，也不改变界面。`public-tests/domain-authority-shadow.ts` 固定验证影子模式零界面变化、权威候选可提交、同日重复工作消失、普通经济规则不能覆盖危险，以及自由叙事仍保持开放。`_qa/authority-shadow.mjs` 已在 `390×844` 与 `320×568` 验证开场可见选项和审计输入逐项相同、候选存在且页面横向溢出为零。`_qa/live-authority-shadow.mjs` 又以媛夕、罗温、塞莱斯特三条作者路线调用真实叙事适配器：修复前 3 条无关自由输入都进入一致性恢复，加入可见危险元数据修复后只剩 1 条完全遗漏活动威胁，加入活动危险本地门禁后恢复数为 0；最终罗温复验为 2 回合、1 次模型调用、0 次修复、0 次恢复、0 次影子状态修改。

`?authority_first=1` 只为本地 QA clone cartridge 为 `authority-first`，不会改变正式 cartridge 的 `shadow` 默认值，也不会把模式写入存档。第一次双尺寸 canary 虽然机械可执行，却暴露了“全失效时回到吃饭、休息、旅行固定菜单”的产品退化，因此默认 fallback 被改为 `createRecoveryChoices()` 的危险/目标/具体事件优先；只有 cartridge 显式设置 `authorityFallbackLimit` 才允许功能行动兜底。复验在 `390×844` 与 `320×568` 都确认：受管失效项被删除，旁边的开放剧情原样保留；全部失效时只显示当前明确目标“在末班月线离站前挣到今晚的房钱”；正文记录与底部按钮一致，横向溢出为零。当前 canary 已通过，但真实生成样本仍不足以默认切换所有玩家。

### 音频与多语言

`audio/StorySynth.ts` 与 `useStoryAudio.ts` 在首次用户手势后创建 Web Audio。环境层通过 `createAmbientTexture()` 生成 19 秒双声道噪声纹理，循环首尾做 1.4 秒融合，再叠加慢速增益漂移与 7–17 秒间隔的非旋律细节。一次性反馈由纸张带通噪声、木质共振、非整数金属泛音与轨缝瞬态组合。`audio/cueDirector.ts` 只把检定、钱币、关系、物品、稀有奖励和真实到站路由到结果声音；普通正文、精力/风闻变化与图片完成静音。Cartridge 合成反馈上限为 `0.045`，引擎再乘 `0.52`；瞬态声部上限为 6、录制短音效上限为 2，并合并 `180 ms` 内突发触发。静音状态通过 scoped storage 持久化，`public-tests/audio-synth.ts` 验证该策略。

内部媒体实验的人耳评审否决了带声视频作为环境循环的方案；更严格的单物件提示仍会夹带稳定音高，因此生产方案已完全撤除生成音频与隐藏视频播放。任务记录、输出地址和账户路径只保存在非公开研发档案中。

`narrativeStyle.ts` 是两种语言共用但分别书写的叙事合同：先明确人物、动作和因果，每段主要推进一个事实，新世界词首次出现时立即以外形、用途或现场反应解释，气氛由具体细节和潜台词承担。`adapters/aigram.ts` 的 system prompt 与 `adapters/remote.ts` 的每回合 user message 都注入这一合同，因此它不仅约束 demo 预写文本，也约束未来大语言模型自由生成的正文、对白、选项和新名词。

### 存储与后端

`useGameSave.ts` 维护一次加载后的本地镜像，避免连续保存时用旧 `savedData` 覆盖新状态。自托管环境的浏览器 key 为 `alteru:<当前部署 session UUID>:wanderlight-save`。平台云存档和叙事调用继续通过 Aigram bridge；图片请求固定发送本游戏 session ID 到 AlterU Media Service。

推荐失败隔离由 `turnConsistency.ts`、`reducer.ts` 和 `useStoryEngine.ts` 共同完成。生成层先删除没有权威进展时对同一物件换动词重试的建议，并拒绝在错误地点/人物/工作状态下复活确定性作者标签；作者回合自身的已审核后续不走语义误杀。两次生成均不可靠时，`applyConsistencyRecovery()` 写入 `consistency-quarantine-v2`，保持权威状态不变，并从提交前选择记录中只删除失败动作、目标包装和旧合成恢复项。连续失败按当前集合继续缩小；集合为空时 `normalizeSave()` 不再补通用按钮。`public-tests/loop-escape.ts` 固定覆盖兄弟保留、严格收缩、零快捷栏重载和语义重复。

## 4. 扩展点

- **修改世界或玩法**：编辑 `src/story/cartridges/wanderlight.ts` 的 director、domain rules 与数值；原有核心路线位于 `wanderlightV1Content.ts` 和 `wanderlightV1Outcomes.ts`，新增地区、人物、抵达入口、重逢和跨区导演规则集中在 `wanderlightWorldExpansion.ts`，地区事件集中在 `wanderlightPresetEvents.ts`。通用判定逻辑放入 `src/story/engine/`，不要藏在提示词里。
- **调整叙事语言**：预写中英文内容位于 `src/story/cartridges/`；未来模型的双语写作底线位于 `src/story/narrativeStyle.ts`，两个生成适配器必须持续注入它。修改后运行 `npm test` 并分别试玩中英文路径。
- **增加角色**：先写稳定角色 ID、明确成年年龄、可见首次登场和 `visualIdentity`；已有审核锚点可直接填 `anchorTaskId`，否则让预设或动态角色在首次可见登场后通过现有媒体流程只生成一次身份锚点。
- **调整画风或素材**：统一修改 cartridge 中的 `GOUACHE`、`sceneImageDirection`、`engine/imageDirector.ts` 与 `doc/visual.md`；正式资产只通过 AlterU Media Service 生成。换风格或镜头合同前必须重新做锚点→换地点 edit 连续性评审以及第一人称无头像引用回归，不能只换一个风格词。
- **调整数值与压力**：修改 cartridge 的 `statDefinitions`、`dangerDirector` 和对应 domain rules，并同步 `doc/requirements.md` 的具体数值与恢复合同。
- **新增后端能力**：Aigram 平台能力扩展 `shared/runtime/bridge.ts`；若未来增加游戏自有 `/api/*`，必须从 `src/game-id.ts` 计算 `API_BASE = '/' + GAME_ID`，禁止写死旧 UUID 或裸请求 `/api/*`。
- **验收**：公开仓库运行 `npm test` 与 `npm run build`。`test:world-expansion` 逐项验证双语 12 节点/8 角色、五个新地区的确定性旅行和三条抵达入口、五名人物初始隐藏、合法首次登场、权威存档写入及已认识后的重逢分支；`test:preset-events` 验证双语 `48` 事件、每地四条、刷新稳定、同地去重、存档持久化、危险/目标优先级和第一人称图片所有权。`test:danger` 以中英双语、所有地图节点和 24 个危险周期运行 `576` 组地点兼容矩阵，并固定验证“洗衣房正文 + 无关危险选项”被管线和 reducer 双层拒绝、合法同地威胁仍可进入警告阶段、活动危险不能被普通短工绕过。`test:choice-quality` 验证生成式占位按钮删除、刚执行动作的即时同义重复删除、活动冲突绝不复用旧 sibling；`test:extended-continuity` 连续 `10` 回合验证营救冲突在观察、商量、等待、无关新冲突和缺失命令下均不能消失，只有可见结算才能关闭。`test:multiturn` 另以中英双语连续跑报价—中间步骤—结算、询价—授权住宿—停止点、插入休息—恢复原线、动态地点—刷新、动态人物—关系持久化、低精力拒绝—恢复—工作—重复门禁共 `12` 条轨迹。支付矩阵包含 `57` 种未来工资组合，恢复专项模拟 `120` 个动态休息地点，地点专项模拟 `120` 个动态地点；浏览器再覆盖完整中英文作者路线、动态人物定型、自由输入刷新锚点、旧循环迁移、短工重复、付款授权、零体力安全菜单、推荐选项正文/底栏/数字输入同源，以及 `390×844`、`320×568` 第一人称事件图无横向溢出。双尺寸视觉证据、媒体任务证据、生成实验和内部发布 QA 保留在非公开研发档案中，不随公开源码分发。
## 2026-08-23 混合音频升级

`src/story/audio/` 现在把本作专属主题音乐与港湾环境声作为持久本地资产播放，同时保留 Web Audio 的按钮、检定、数值和事件即时反馈。长音频只在用户手势后启动；环境声每次地点访问只播一次，A 类底乐自然结束后才允许按阅读留白规则返回。文件失败不阻塞剧情，并回退到合成声音或静音。

## 2026-08-23 阅读优先 A/B 配乐

`theme.mp3` 已改为低密度区域阅读底乐 A，自然结束后至少留白 30 秒；`feature.mp3` 是关键揭示、关系转折或阶段小结才会触发的 B。B 播放时暂停 A、保留环境声，结束后恢复 A；同一 B 至少冷却 180 秒，静音或切后台会取消它，不在恢复时补播。

## 2026-08-23 一次性环境与事件音

环境声在每次进入一个地点时只播一遍，播完保持安静；只有真实离开并重新进入才获得一次新的播放。短事件音按已提交事件只播一次，静音切换、页面恢复、重渲染、读档和重连均不补播。`_qa/one-shot-audio.ts` 固定验证同地点不复播与换地点后只新增一次播放。
