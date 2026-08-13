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
  protocol-security.ts              # 可公开的协议边界与恶意输入回归
  choice-contract.ts                # 正文、行动票和数字输入同源回归
  reading-anchor.ts                 # 续玩恢复点不落入底部空白的回归
```

## 3. 核心模块

### 状态、协议与回合

`useStoryEngine.ts` 负责读取 cartridge、提交玩家动作、调用适配器、解析结构化命令，并把结果一次性交给 `engine/reducer.ts`。人物、地点、关系、物品、数值、危险阶段、图片块和选择都属于 `StorySave` 权威状态；模型正文不能直接绕过 reducer 改写存档。`engine/domainRules.ts` 权威结算短工、餐食、住宿、车厢休息和六条普通车票路线，并用 `clock-add` 保持跨日时间；`engine/continuity.ts` 为跨地区旅行补充月线中转，但不会重复已经由正文亲历的车厢场景。

七个地图节点分别保存本地工作、社交和休息事实；这些事实进入 Aigram 世界上下文，防止自由生成把所有地点写成同一套活动。危险导演为新存档保留六个完整场景的首轮宽限，且作者/住宿 `session_end` 检查点不再叠加随机危机，避免自然落点被无关判定卡打断。

### 角色视觉身份与图片生成

每个长期角色用稳定 ID 关联 `CharacterVisualIdentity`。权威存档保存身份状态、版本、`anchorTaskId`、不可变特征、服装语言和禁止漂移项，不持久化服务的临时图片 URL。预设角色指向已审核锚点任务；动态角色在可见正式登场后先调用一次 `text` 生成 `512×640` 单人锚点，成功后保存任务 ID，再从锚点图片以单参考 `edit` 生成剧情动作图。

`shared/runtime/media.ts` 实现自有服务请求、尺寸适配、任务轮询、结构化错误与可重试信息。网络结果不明确时，同一次生成的重试复用同一个 `request_id`，避免重复任务；明确的新锚点与新场景使用新的 UUID。当前服务只允许单参考，所以一张图只有一个视觉身份所有者；双人关系用视点、肩后、背影、剪影或正反打表达。

人物详情公开显示 `queued / generating / anchored / failed / unanchored` 的视觉身份状态。锚点失败不阻塞文字叙事，但在成功重试前不会继续生成该角色的无参考清晰面孔。领域规则触发的旅行会被 reducer 合成为图片导演可读的 `map_update`，因此即使没有模型图片提示，也会为首次抵达安排地点空镜；地点的工作、社交与休息事实会进入构图提示，且开场行李、种荚和雨街残留由图片导演拒绝。

### 屏幕适配与交互

界面采用累积阅读流，事件图片留在它所属的回合中。`protocol.ts` 即使同时收到正文项目符号和结构化 `[choices]`，也会提取并删除正文里的重复列表，并让玩家已经看见的尾部行动成为该回合权威选项；模型适配器同时禁止重复输出两套选项。reducer 将最终选项编码为 `choices-<scene>` 阅读块，因此正文 `01 / 02 / 03` 记录和底部行动票始终来自同一数据。`choiceInput.ts` 把输入框中的 `1 / 01 / 2 / 02 / 3 / 03` 映射到当前同号选项，其他内容继续作为自由行动。`readingAnchor.ts` 从权威阅读块中寻找最近一轮玩家行动；继续存档和“有新内容”都滚到这个可读锚点，而不是包含 `60dvh` 排版缓冲的物理底部。窄屏通过内部布局适配，不使用整页缩放；底部选择使用 `onClick`，触控目标至少 `44×44px`。入口和平台内主构图不为外部访客栏预留永久空间。

顶部工具由 `Icons.tsx` 的同一套 `24×24 / 1.7px` 线性 SVG 驱动，文字、声音和旅途手册共享等宽分段控件。HUD 使用浅色票券网格，精力、旅费、风闻都带进度轨并保留数值变化动效。旅途手册在普通入口下先展示目标与旅程概况；只有点击某个 HUD 数值时，对应状态卡才置顶。人物与路线页只读取已经登场的角色和已发现地点，并把关系轴转换为玩家可读的共同经历文案。

### 音频与多语言

`audio/StorySynth.ts` 与 `useStoryAudio.ts` 在首次用户手势后创建 Web Audio，按选择、状态变化、危险、身份固化和月线中转播放程序化短音；静音状态通过 scoped storage 持久化。`i18n.ts` 和双语 cartridge 支持中文/英文，入口海报只有英文且所有运行时图片提示词禁止文字与伪文字。

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
- **验收**：公开仓库运行 `npm run test:security`、`npm run test:choices`、`npm run test:resume` 与 `npm run build`。正文/行动票对齐、数字输入、恢复阅读锚点和恶意协议边界均有可公开机械回归；完整六路浏览器试玩、双尺寸视觉证据、媒体任务证据、生成实验和内部发布 QA 保留在非公开研发档案中，不随公开源码分发。
