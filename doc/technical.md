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
  story/cartridges/wanderlight.ts    # 双语世界、七区域规则、角色锚点和图片导演参数
  story/cartridges/wanderlightV1Content.ts   # 罗温/塞莱斯特的首次登场、工作、中转与重逢
  story/cartridges/wanderlightV1Outcomes.ts  # 三名核心角色的边界判断、同行与自然停止点
  story/engine/                      # 协议、reducer、领域规则、危险、连续性与图片导演
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
```

## 3. 核心模块

### 状态、协议与回合

`useStoryEngine.ts` 负责读取 cartridge、提交玩家动作和调用适配器；生成结果统一先进入 `engine/turnPipeline.ts`，按同一份提交前存档依次完成支付规范化、地点/图片/选项规范化、机械校验与提交判定，只有通过后才一次性交给 `engine/reducer.ts`。人物、地图节点、具体场景、关系、物品、数值、工作合同、危险阶段、图片块和选择都属于 `StorySave` 权威状态；模型正文不能直接绕过 reducer 改写存档。`protocol.ts` 同时兼容标准 `[command: ...]` 与模型偶发的 `[command key="..."]` 缺冒号属性格式，机器协议不会进入可见正文；存档规范化也会移除旧版本已经泄漏的完整协议块。`engine/domainRules.ts` 权威结算短工、餐食、普通/现场休息、公共休息处撤退、住宿、车厢休息、泛化消费澄清和六条普通车票路线，并用 `clock-add` 保持跨日时间；`rest-commitment` 意图门禁区分真正休息与询价/问路，`dangerPolicy` 决定恢复回合禁止同回合危险、或在撤退时原子结束当前威胁。`engine/continuity.ts` 为跨地区旅行补充月线中转，但不会重复已经由正文亲历的车厢场景。

动态有偿工作使用 `[job]` 协议：`offer` 固化稳定工作 ID、雇主、工作内容和明确工资，`settle` 只能结算未完成合同，并由 reducer 直接按记录工资增加钱币和 `jobs_completed`；同回合额外的 coin widget 会被拒绝且 reducer 也做去重防御。罗温和塞莱斯特的开局即时短工同样使用稳定 `offer → settle`，不再靠正文旁的裸加币命令。`paymentConsistency.ts` 在任何生成正文写入存档前机械核对钱币、铜板、铜币、硬币等报价、付款、消费和合同金额，并用当前玩家行动做消费授权门禁：询价、寻找和考虑不是付款同意；“把钱全部花完”没有购买对象，也不是交易授权，Cartridge 的精确领域规则会解释余额未变并要求选择具体商品或服务。未经授权的消费正文、正文声称花光但没有合法事务、隐藏扣款均拒绝；“你用这枚硬币支付”会识别为一枚支出，正向 coin widget 会被判为方向冲突。明确订房由 `overnight-room` 领域规则原子完成余额门禁、扣 `10` 枚、写入 `lodging_secured` 与结束当晚，模型不参与结算。钱币达到 `10` 时目标自动从挣钱推进为住宿/工作/搭车决策，未订房又降到 `9` 以下时退回挣钱。首次一致性失败会要求当前适配器完整重写同一回合，第二次仍失败则不提交。

每个非 demo 生成回合还必须输出唯一 `[scene_location]`；正文跨地图节点抵达必须同回合输出 `[map_update]`，明确接受或被交付一项新任务时必须输出 `[state]`，场景图必须用 `[image_location]` 声明与 `scene_location` 完全相同的具体场景。`StorySave.location` 保存权威地图节点，`sceneLocation` 保存旅店、工坊、田舍等当前具体场景；旧存档缺少后者时回退到地图节点。地图节点的双语 `routeHints` 提供稳定语义指纹；动态地点的 `[map_update]` 额外接受稳定 `location_id` 与管道分隔的 `route_hints`。reducer 只保留正文、地图公开描述或玩家明确命名动作已经证明的别名，丢弃隐藏/泛化别名，并把后续别名合并到同一 ID；缺少模型 ID 时按规范化地点名生成确定性后备 ID。旧动态存档补入规范地点名，只在最近可见历史同时证明父地点和当前子地点时恢复该子地点别名。`turnConsistency.ts` 的 `inferActionDestination()` 要求行动同时具备移动/承诺动词和唯一非当前节点指纹，因而可把“往田野深处检查藤架”解析到 `silverleaf-vineyard`，但不会因在车厢里讨论田野而传送；别名分数并列或一个既有 ID 被用于不同规范地点名时拒绝。`canonicalizeTurnMetadata()` 用唯一目的地补齐遗漏的 `map_update`，替换旧地点的 `scene_location`，并允许“田野深处”等节点内细分地点继续作为具体场景。模型明确声称玩家仍在旧地点时不静默改写，而是进入修复。模型缺少地点绑定或只把图片绑到父级地图的提议会被丢弃并交由本地图片导演重建；可信作者图可在本地绑定当前具体场景。

真正的状态冲突会触发一次完整重写；重写仍不一致时，普通未知行动由 `applyConsistencyRecovery()` 拒绝不可靠内容、保持地点/目标/数值/物品/关系不变，并把未经证明的失败行动写入 `lastActionId` 与隔离事实。每轮合法选择在 reducer 提交后由 `bindChoiceDestinations()` 预解析；可确定路线保存 `targetLocationId`，重载时重新绑定。刚点击的系统跨地点按钮优先读取这个稳定 ID，再回退到实时语义推断；若模型和一次修复仍失败，`applyDisplayedRouteFallback()` 只提交本地确定的 `map_update + scene_location`，用统一 transition/effect 记录抵达，并从新地点生成可执行选择，不再退回“仍在旧地点”。如果唯一问题是 `turn.requires_actionable_choices`，`turnPipeline` 允许提交已经合法发生的正文与状态：普通同地图回合先沿用仍有依据且未刚执行的旧选项，危险回合使用 `dangerDirector.methods`；当上一轮只剩刚完成的一项而没有 sibling 时，`deriveReplylessChoices()` 改从当前地点、当前目标与同行者权威状态派生新出口，排除已完成动作，并把最终选项写入同场景记录。自由输入仍开放，但进行中的普通场景不再只剩输入框，也不为补数量创造新实体。支付、地点、任务、图片或其他状态问题绝不走这条旁路。`repairLegacyConsistencyRecovery()` 同步改写旧正文、文章选项和底部选项；`restoreDeterministicRecoveryChoice()` 进一步识别后来已经由确定性规则或唯一语义目的地证明可执行的旧失败行动，将其作为精确本地路线恢复。

`canonicalizeTurnMetadata()` 还会在回合提交前逐项处理选择：删除不能在新场景中直接行动的旧地点选项，再用 `filterGroundedChoices()` 检查当回合正文与权威人物、地图详情、物品、活动工作和数值定义。中文先拆分稳定实体，把“具体情况、进一步消息、解决办法、调整行程、保存精力”等普通提问/动作修饰语排除，再要求剩余复合词能分解成各自至少两个字、且来自单条可见正文或权威状态的片段；禁止任意二字命中或凭空放入未知人名、地名与物品。匹配 Cartridge 领域规则的选项不再用正文词面放行：只有 `resolveDomainAction()` 返回 `accepted` 才保留，`rejected` 在显示前删除。过滤是逐项而不是整组否决；剩下 `1–5` 项都可直接提交和渲染。

`authoredTurns.ts` 将当前仍显示且玩家仍在开局地图节点的固定 choice 映射到 `opening.deterministicTurns`；因此先询价或观察后，未领取的三条开局工作仍由本地固定路线执行，不再受 `scene === 0` 限制。`deterministicChoiceTurns` 处理后续已经成立的合同、固定同行、主路线节点和作者支线按钮；它必须同时精确匹配当前可见按钮，并满足声明的地点、稳定人物和工作状态。所有系统按钮仍经过统一支付/地点/选项校验；相似自由输入不会被关键词误捕，继续调用 Adapter。

七个地图节点分别保存本地工作、社交和休息事实；这些事实进入 Aigram 世界上下文，防止自由生成把所有地点写成同一套活动。危险导演为新存档保留六个完整场景的首轮宽限，威胁选择加入当前地图节点，避免不同路线每轮都重复同一威胁；威胁一旦进入 warning/confrontation 则保持不变直到结算。模型丢失全部危险选项时，reducer 直接使用 Cartridge 配置的三种应对方法，不回退到旧目标文案。

### 角色视觉身份与图片生成

每个长期角色用稳定 ID 关联 `CharacterVisualIdentity`。权威存档保存身份状态、版本、`anchorTaskId`、不可变特征、服装语言和禁止漂移项，不持久化服务的临时图片 URL。预设角色指向已审核锚点任务；动态角色在可见正式登场后先调用一次 `text` 生成 `512×640` 单人锚点，成功后保存任务 ID，再从锚点图片以单参考 `edit` 生成剧情动作图。

`engine/characterContinuity.ts` 在统一回合管线和 reducer 两层执行人物门禁。新动态角色必须同时满足：正文先出现可辨认形态或动作、正文给出日常名字来源、名字之后出现当前意图或互动、协议提供合法稳定 ID、英文外貌合同和至少一项不可变特征。`character_update` 不能让已有 ID 改名，也不能把已有姓名绑定到另一个 ID；`party_change add` 只能引用已经固化的人物，并要求正文明确同行；关系命令不能顺带创造陌生人。管线层将违规草稿送去一次修复，reducer 层即使在 demo 或直接调用时也拒绝写入。

`shared/runtime/media.ts` 实现自有服务请求、尺寸适配、任务轮询、结构化错误与可重试信息。网络结果不明确时，同一次生成的重试复用同一个 `request_id`，避免重复任务；明确的新锚点与新场景使用新的 UUID。浏览器媒体回归会拦截公开服务合同，验证首次动态角色依次发送 `text` 锚点与单参考 `edit` 场景请求，刷新后只解析已保存的 `anchorTaskId` 并再次发送同参考 `edit`，同时确认任何临时 URL 都没有进入人物存档。当前服务只允许单参考，所以一张图只有一个视觉身份所有者；双人关系用视点、肩后、背影、剪影或正反打表达。

人物详情公开显示 `queued / generating / anchored / failed / unanchored` 的视觉身份状态。锚点失败不阻塞文字叙事，但在成功重试前不会继续生成该角色的无参考清晰面孔。领域规则触发的旅行会被 reducer 合成为图片导演可读的 `map_update`，因此即使没有模型图片提示，也会为首次抵达安排地点空镜；地点的工作、社交与休息事实会进入构图提示，且开场行李、种荚和雨街残留由图片导演拒绝。

`imageDirector.ts` 的兜底节奏为连续 `2` 个有效回合没有新图即补图；地点变化、关系转折和任何说话者的重要对白可立即触发。重要性根据对白是否揭示关键事实、改变关系、设定边界、作出承诺/请求、警告危险、建立任务或形成明显情绪转折判定；适配器还可用 `[dialogue_focus]` 明确说话者与可见表情。对白镜头不依赖有限情绪词，也不受普通配图节流限制，并优先于模型提出的普通环境图。已有 `visualIdentity` 的说话者从稳定人物 ID 取得锚点；动态未锚定人物不会借用其他身份，但仍使用中近景反应镜头并保留当前地点背景。`engine/itemImage.ts` 独立构造行囊图鉴 prompt；`ITEM_IMAGE_STYLE_VERSION=3` 会让旧写实缓存失效并在再次打开行囊时重新排队。内部媒体 QA 已验证编辑水粉、无文字与准确三枚印章；公开文档不记录过程任务 ID。

### 屏幕适配与交互

顶部手册入口使用原有笔记本图标，不渲染可见文字，并与文字大小、声音控件复用相同的 44px 图标按钮布局；点击后默认直达 `party` 数据页。抽屉内四个栏目图标统一为 `24×24`、`1.7px` 圆角描边，并分别用人物连接、折叠节点路线、带扣旅行包和装订手册表达。人物关系页在列表前渲染关系总览，并把玩家自身状态移至列表末尾，避免遮挡关系内容。人物行从 `StorySave.relationships` 聚合关系印象和共同经历数，人物详情首屏使用高对比关系摘要，完整事件仍读取同一权威数组，不维护第二份关系状态。

界面采用累积阅读流，事件图片留在它所属的回合中。`protocol.ts` 即使同时收到正文项目符号和结构化 `[choices]`，也会提取并删除正文里的重复列表，并让玩家已经看见的尾部行动成为该回合权威选项；模型适配器同时禁止重复输出两套选项。reducer 将最终选项编码为 `choices-<scene>` 阅读块，因此正文从 `01` 起的连续编号记录和底部行动票始终来自同一数据。`choiceInput.ts` 把输入框中的普通或补零数字映射到当前同号选项，其他内容继续作为自由行动。`readingAnchor.ts` 从权威阅读块中寻找最近一轮玩家行动；继续存档和“有新内容”都滚到这个可读锚点，而不是包含 `60dvh` 排版缓冲的物理底部。窄屏通过内部布局适配，不使用整页缩放；底部选择使用 `onClick`，触控目标至少 `44×44px`。入口和平台内主构图不为外部访客栏预留永久空间。

顶部工具由 `Icons.tsx` 的同一套 `24×24 / 1.7px` 线性 SVG 驱动，文字、声音和旅途手册共享等宽分段控件。HUD 使用浅色票券网格；精力、风闻保留进度轨，钱币只显示余额。`HeaderStat` 在值变化时同时保留旧值和新值，以方向相反的双层滚动交代前后关系，并显示 `+N / −N`；`prefers-reduced-motion` 下取消位移但保留静态变化量。点击任一 HUD 数值会打开对应玩家状态卡；三项 `StatDefinition.description` 分别说明它代表什么、如何变化和阈值影响。旅途手册默认进入人物列表。`CharacterPortrait` 通过角色持久化的 `anchorTaskId` 解析身份锚点 URL，并用模块级 Promise 缓存避免重复任务查询；同一图分别用于对话小头像、人物列表缩略图和详情竖幅大图，没有可用锚点时退回首字母。人物列表同时把关系事件汇总成“初识 / 熟悉 / 信任 / 默契 / 戒备”与共同经历数，人物详情仍展示事件来源；这不是公开好感度分数。

`StatDefinition.floorRule` 是数值归零的权威门禁，但恢复规则从 `0–100` 任意精力值都可执行。`resolveDomainAction()` 在调用模型前把“去屋里休息、选择休息、小睡”等中英文明确行动归入本地普通休息，同时排除询问位置、房价和可用性的非授权表达；`applyParsedScene()` 在数值首次触底的同一回合写入世界内解释并替换底部选项；`normalizeSave()` 对已经保存的精力 `0` 旧档执行同样迁移。普通休息 `+8`、公共休息处 `+16`、热饭 `+12`、客房 `+28`、整夜 `+36` 和车厢 `+8` 都由 domain rules 原子结算；`domainMaxDelta=36` 只放宽可信本地交易，模型 widget 仍受 `maxDelta=24` 限制。危险未解除时普通恢复被原子拒绝；公共休息处撤退追加权威 `danger` 效果。`useStoryEngine()` 与 reducer 双层调用 `domainSuppressesDanger()`，防止外部或旧调用方把随机失败扣除叠加到已接受的休息回合。

### 音频与多语言

`audio/StorySynth.ts` 与 `useStoryAudio.ts` 在首次用户手势后创建 Web Audio。环境层通过 `createAmbientTexture()` 生成 19 秒双声道噪声纹理，循环首尾做 1.4 秒融合，再叠加慢速增益漂移与 7–17 秒间隔的非旋律细节；它不加载任何媒体服务音轨。一次性反馈由纸张带通噪声、木质共振、非整数金属泛音与轨缝瞬态组合。`audio/cueDirector.ts` 根据 reducer 写入的 `stat / delta / itemAction / relationshipChange / arrival` 元数据，将钱币增减、精力、风闻、关系、物品、稀有奖励和真实到站路由到不同声音；普通正文不触发音效。静音状态通过 scoped storage 持久化。`public-tests/audio-synth.ts` 机械验证双声道、循环边界和事件路由。

内部媒体实验的人耳评审否决了带声视频作为环境循环的方案；更严格的单物件提示仍会夹带稳定音高，因此生产方案已完全撤除生成音频与隐藏视频播放。任务记录、输出地址和账户路径只保存在非公开研发档案中。

`narrativeStyle.ts` 是两种语言共用但分别书写的叙事合同：先明确人物、动作和因果，每段主要推进一个事实，新世界词首次出现时立即以外形、用途或现场反应解释，气氛由具体细节和潜台词承担。`adapters/aigram.ts` 的 system prompt 与 `adapters/remote.ts` 的每回合 user message 都注入这一合同，因此它不仅约束 demo 预写文本，也约束未来大语言模型自由生成的正文、对白、选项和新名词。

### 存储与后端

`useGameSave.ts` 维护一次加载后的本地镜像，避免连续保存时用旧 `savedData` 覆盖新状态。自托管环境的浏览器 key 为 `alteru:<当前部署 session UUID>:wanderlight-save`。平台云存档和叙事调用继续通过 Aigram bridge；图片请求固定发送本游戏 session ID 到 AlterU Media Service。

## 4. 扩展点

- **修改世界或玩法**：编辑 `src/story/cartridges/wanderlight.ts` 的 director、domain rules、数值、地图与角色；核心路线正文位于 `wanderlightV1Content.ts` 和 `wanderlightV1Outcomes.ts`。通用判定逻辑放入 `src/story/engine/`，不要藏在提示词里。
- **调整叙事语言**：预写中英文内容位于 `src/story/cartridges/wanderlight.ts`；未来模型的双语写作底线位于 `src/story/narrativeStyle.ts`，两个生成适配器必须持续注入它。修改后运行 `npm run test:narrative` 并分别试玩中英文路径。
- **增加角色**：先写稳定角色 ID、明确成年年龄、可见首次登场和 `visualIdentity`；预设角色填审核后的 `anchorTaskId`，动态角色保留首次登场后自动固化流程。
- **调整画风或素材**：统一修改 cartridge 中的 `GOUACHE`、`sceneImageDirection` 与 `doc/visual.md`；正式资产只通过 AlterU Media Service 生成。换风格前必须重新做锚点→换地点 edit 连续性评审，不能只换一个风格词。
- **调整数值与压力**：修改 cartridge 的 `statDefinitions`、`dangerDirector` 和对应 domain rules，并同步 `doc/requirements.md` 的具体数值与恢复合同。
- **新增后端能力**：Aigram 平台能力扩展 `shared/runtime/bridge.ts`；若未来增加游戏自有 `/api/*`，必须从 `src/game-id.ts` 计算 `API_BASE = '/' + GAME_ID`，禁止写死旧 UUID 或裸请求 `/api/*`。
- **验收**：公开仓库运行 `npm run test:image-director`、`npm run test:turn`、`npm run test:deterministic-choices`、`npm run test:domain`、`npm run test:rest-recovery`、`npm run test:payment`、`npm run test:security`、`npm run test:choices`、`npm run test:resume`、`npm run test:audio` 与 `npm run build`。恢复专项模拟至少覆盖中英文任意精力主动休息、动态地点休息选项、问询不误判、客房/整夜真实恢复值、危险拒绝与安全撤退、恶意模型指令隔离和同回合危险不叠加。任何说话者的重要对白强制表情镜头、已锚定人物身份绑定、动态人物不借错身份、环境图覆盖防护、短事务对白不过度出图、场景/目标/选项/配图原子对齐、所有作者按钮所有权、领域选项显示前可用性、选项缺失单故障提交、确定性合同按钮与旧恢复存档修复、报价不入账、合同原子结算、截图模糊付款拦截、消费授权、询价不扣款、“支付却 +1”方向拦截、住宿原子状态、重复结算防护、正文/行动票对齐、数字输入、恢复阅读锚点、程序化音频和恶意协议边界均有公开机械回归；完整六路生产模式浏览器试玩还会对生成层注入不一致回复，要求主路线零 `game-chat` 调用完成，并单独验证自由输入一次调用与不可执行输入具体解释。双尺寸视觉证据、媒体任务证据、生成实验和内部发布 QA 保留在非公开研发档案中，不随公开源码分发。
