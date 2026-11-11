# dsh-enhance

给 **DeepSeek Harness（dsh）** 补两块能力。它是**一个插件、两个可分别启停的组件**：

| 组件 | 做什么 |
| --- | --- |
| **自动化任务**（`dsh-enhance-schedule`） | 在输入框下方的状态栏里，为**当前对话**创建一个自动化任务，并直接打开官方右侧任务页签 |
| **会话解压**（`dsh-enhance-session-unpack`） | 给 agent 一个 `unpack_session` 工具，把一个 dsh session 解压成可读的目录（`transcript.md` + `session.jsonl` + `meta.json`） |

插件页里这两个组件各带自己的名字、描述和开关 —— 关掉其中一个，另一个照常工作。

中文 | [English](./README.en.md)

---

## 一、「会话解压」组件：`unpack_session`

### 它解决什么问题

dsh 的 session 存在磁盘上，是一个**只追加的日志**：`session.v4.jsonl.zstd`——里面是**拼接的 Zstandard 帧**，每帧一次追加，一行一个 JSON 事件。Node 自带的 `zstdDecompressSync` 对这种文件只会解出第一帧（249 字节的 header），所以普通解压工具拿到的是空的。

再加上 session 可能**不在你手边**：它在另一套安装里（`E:/dsh-desktop-portable`）、是归档导出的 zip、或者只是长会话的后半段——模型在当前会话里根本看不到它。

`unpack_session` 就是干这件事的：给它一个安装目录/家目录 + session id（或者直接给一个压缩包），它把那个 session 解成一个目录：

| 文件 | 内容 |
| --- | --- |
| `transcript.md` | 对话正文（官方 `formatSessionMarkdown` 的排版：用户消息是 `>` 引用，工具调用/结果折叠进 `<details>`，每轮收尾回复平铺） |
| `session.jsonl` | **完整**解码后的事件流（解压真相，不裁剪） |
| `meta.json` | session id、标题、来源路径、轮次数、事件数、锚点、导出时间 |

### 用法

对 agent 说人话就行，比如：

> 给 LLM 发消息说 `E:/dsh-desktop-portable` 的 `session-98c50cd6-2429-4425-898b-1dbe90d19a8e`，从「你关闭弹窗，然后使用探照灯，了解 名称 这个下拉的 dom结构」开始分析

工具的参数：

| 参数 | 说明 |
| --- | --- |
| `source` | dsh 安装目录、dsh 家目录，或者一个 session 制品文件（`session.vN.jsonl.zstd` / `session.vN.jsonl` / 导出的 `.zip`） |
| `session` | source 是目录时必填：session id |
| `from` | 起点锚点：**用户消息的一段文字**，或者**轮次号**。命中的那一轮是第一轮导出的轮次 |
| `maxTurns` | 只导出这么多轮 |
| `out` | 产物目录。默认 `%TMP%\dsh-session-unpack\<session-id>` |

`source` 支持的目录形态：`<目录>/sessions` 或 `<目录>/home/sessions`；session 日志在 `<home>/sessions/<workspace-slug>/<session-id>/session.vN.jsonl.zstd`，多代次时取新的那代。

### 越界读取要批准

这个工具的活儿就是读**当前工作区之外**的 session 日志，所以越界时它会**先问用户**（`ctx.approval.request`），批准了才读盘。免问的情况：

- 部署本来就是 `danger-full-access`；
- 制品在本会话的工作区里；
- 制品在部署**显式授予**的目录里（`--add-dir` / `additionalWritableRoots`）；
- 本会话的批准策略是 `ask` 且用户点了允许。

注意顺序：**路径先解析、批准先要、内容后读**——批准没拿到之前，一个字节都不会从磁盘上读。

批准策略是 `never` 的会话（比如无头跑批）**用不了**这个工具，会明确报错而不是偷偷读。

### 它怎么工作

| 部位 | 职责 |
| --- | --- |
| `src/session-unpack/frames.js` | Zstandard 帧边界扫描与逐帧解码 |
| `src/session-unpack/zip.js` | ZIP 中央目录解析与条目读取 |
| `src/session-unpack/paths.js` | home / session 日志定位 |
| `src/session-unpack/log.js` | 制品读取与事件解析 |
| `src/session-unpack/transcript.js` | 事件流 → 轮次、transcript 渲染 |
| `src/session-unpack/artifacts.js` | 三产物写出 |
| `src/index.js` | 宿主入口：`ctx.tools.register` 注册 `unpack_session`，以及越界读取的批准 |

几个关键决定：

- **自己扫 Zstandard 帧边界**：帧头自述布局、块头自述大小，所以不解压也能走边界；然后逐帧 `zstdDecompress`。官方 `session-persistence-jsonl` 的 zstd.ts 也是纯字节扫描。
- **解压不阻塞宿主**：逐帧解压走 `node:zlib` 的异步接口（在 libuv 线程池里跑），事件流解析与 transcript 渲染每 200 个事件 / 50 轮把事件循环让回宿主。
- **可取消**：每帧之间、每批事件之间检查 `exec.signal`，被取消时抛 `AbortError`，**不留下半成品目录**（目录在产物都备好之后才建）。
- **ZIP 自己读**：EOCD + 中央目录 + local header，异步 `inflateRaw` 解 deflate；**ZIP64 明确报错**，不猜。
- **宿主半不 import 任何 Harness 包**：`ctx.tools.register` 接受纯对象（`defineTool` 只是类型辅助），zstd/zip 全用 `node:zlib` 手写。
- **`session.jsonl` 写完整事件流，`transcript.md` 才按锚点裁剪**：解压的真相和阅读的便利分开。
- **产物默认落临时目录**：不污染用户仓库；`out` 可以覆盖。

---

## 二、「自动化任务」组件：给当前对话建一个自动化任务

### 它解决什么问题

dsh 自带的「新建自动化任务」只能建**新会话**或**一次性新会话**的任务：任务到了时间会开一个新对话去做事。
但很多场景不是这样——套餐额度用光、等下个周期时，你想把活**排进眼下这个会话**，让结果直接落在这个对话里。

这个插件补上这个缺口：在输入框下方的状态栏点一个「定时任务」，填一张表（任务名称 / 任务内容 / 时间），
任务就绑定在**这个会话**上，到点由这个会话接着做。典型用法是「额度恢复后继续当前未完成的工作」。

任务本身仍然是 dsh 原生的自动化任务：它出现在官方「自动化任务」面板、会话头部的任务目录徽标里，
可以在官方右侧页签里查看、编辑、立即执行、删除。插件只是**新建的入口**，不另造一套任务系统。

### 特点

- **零歧义**：入口就在当前会话的状态栏里，绑定的就是屏幕上这个会话，没有会话选择器，也不会误绑到别的对话。
- **界面与官方一致**：弹窗是官方任务编辑器的一份移植（行式规则、执行位置 / 运行时间：重复·间隔·星期·日期·时间·时区），
  建完就直接落到官方任务详情页，编辑、立即执行、删除都在官方界面里。
- **不加载官方前端包**：插件**自带**弹窗、按钮、输入框、下拉菜单、月历卡片与时钟卡片的实现，
  不 import 任何 Harness Client 包（官方插件规范的要求），因此不会和 dsh 版本的前端包实现打架。
- **不改动 dsh 源码**：纯插件实现，升级 dsh 不用打补丁。
- **运行时零依赖**：产物里只有 Node 自带模块，没有第三方运行时依赖；源码用 tsdown 构建成 `lib/`。

### 怎么用

1. 打开任意一个会话；
2. 点输入框下方状态栏里的**「定时任务」**（和轮次、token 用量那一排在一起）；
3. 填**自动化任务名称**、**自动化任务内容**，选重复规则、日期和时间；
4. 点「创建」。

弹窗里的行与官方「手动创建」弹窗一一对应：

- **执行位置**：当前关联会话（固定，因为任务就建在眼前这个会话上）
- **运行时间 → 重复**：每周 / 周一至周五 / 每天 / 每 N 小时 / 每 N 分钟 / 每月 / 仅一次 / 自定义
- **运行时间 → 重复间隔**：除「仅一次」和「自定义」外的规则都有，用步进器调 N
- **运行时间 → 星期**：选「每周」时出现，一二三四五六日七个药丸
- **运行时间 → 日期**：仅一次时才有，点开是自绘的月历卡片
- **运行时间 → 时间**：点开是自绘的时 / 分 / 秒三列时钟卡片；「每天」按官方口径只到分钟
- **运行时间 → 时区**：可搜索的时区菜单，默认本机时区

官方那套「少了必填项就只把创建按钮置灰、不写红字提示」的做法也照抄：只有宿主真的拒绝了创建，
弹窗底部才会出现一行失败原因。

创建成功后，官方右侧页签会自动打开这个任务的详情页。任务到点后会向这个会话投递一次执行；
想提前撤销，在右侧页签右上角「⋯ → 删除任务」。

---

## 目录结构

源码在 `src/`，交付物在 `lib/`。`lib/` 是构建产物，不进版本库。

```
dsh-enhance/                  bundle：只往组合树里插两行，自己不带代码
├── cordis.patch.yml
├── locale/                   插件页的标题与描述
└── packages/
    ├── schedule/             组件一：自动化任务
    │   ├── src/index.js      宿主半（空入口）
    │   ├── src/client/       浏览器半（按职责拆成十几个模块）
    │   ├── lib/              构建产物（不入库）
    │   └── tsdown.config.mjs
    └── session-unpack/       组件二：会话解压
        ├── src/index.js      宿主入口：注册工具、处理越界批准
        ├── src/session-unpack/  解压实现（frames / zip / paths / log / transcript / artifacts）
        ├── lib/              构建产物（不入库）
        └── tsdown.config.mjs
```

## 安装

这是一个 dsh **组合包（bundle）**，装进 profile 即可。bundle 自己不带代码，它只往组合树里插两行，
分别指向两个组件包；两个组件包也要一起装进 profile 的 `node_modules`，宿主才能按包名加载它们。

### 1) 先构建

link 安装指向的就是这个目录，所以**装之前必须先构建一次**，否则 profile 里没有 `lib/`，
宿主按包名加载组件时只会拿到一个空入口：

```sh
# 根目录一次构建两个组件包
npm install
npm run bundle
```

也可以进单个组件包构建（`npm run watch` 则是一直盯着 `src/` 重建）：

```sh
cd packages/schedule && npm install && npm run bundle
cd packages/session-unpack && npm install && npm run bundle
```

> 构建只需要一个开发期依赖：`tsdown`。运行时依赖为零，产物里只有 Node 自带模块。

### 2) 再装进 profile

```sh
# 1) bundle 本身（它定义「包含的组件」这个清单）
dsh plugin --profile <你的 profile> add link:/绝对路径/dsh-enhance

# 2) 两个组件包（普通依赖，不是 profile layer）
dsh plugin --profile <你的 profile> add link:/绝对路径/dsh-enhance/packages/schedule
dsh plugin --profile <你的 profile> add link:/绝对路径/dsh-enhance/packages/session-unpack
```

> `declares no dsh.bundle — installed as a plain dependency, not a profile layer` 这句
> 是**装载 profile 时**（dsh 启动做依赖对账）打的，不是 `add` 命令当场打的。
> **这是预期的**：组件包不该自己成为 profile layer，否则它们会变成两个独立的插件。
> bundle 的 patch 行按包名找它们，pnpm 把它们 link 进 `node_modules` 就够了。

装完用 `dsh --profile <你的 profile> --dump-config` 可以看到 `dsh-enhance` 这一层已经进树，
插件页的「包含的组件」显示两个组件、各自一个开关。

> 需要 dsh **>= 0.2.2-rc.1**（由包清单里的 `engines.dsh` 声明）。
> 浏览器端是 Web 组合包，桌面端（Electron）同样使用这套浏览器半。

## 卸载

`dsh plugin` 是 pnpm 的转发器，一次只删一个依赖，所以三条都要执行：

```sh
dsh plugin --profile <你的 profile> remove dsh-enhance
dsh plugin --profile <你的 profile> remove dsh-enhance-schedule
dsh plugin --profile <你的 profile> remove dsh-enhance-session-unpack
```

只删第一条的话，两个组件包会作为普通依赖留在 profile 的 `node_modules` 里：组合树不再引用它们，
但文件还在盘上。

## 版本兼容与已知取舍

客户端半只依赖三个宿主契约：`conversation.composer.dock` 这个 slot、`remote.schedule.create` 这个端点、
以及 `sidebarRight.openTab('scheduleTask')` 这个官方页签 kind。宿主改了这三样里的任何一个，插件都要跟着改。
宿主半只依赖 `ctx.tools.register` 和 `ctx.approval`。

几个明确的取舍：

- **弹窗不进官方的全局 modal 栈**：插件的弹窗是自己画的，只和**自己叠的**下拉菜单争 Escape 与 Tab；
  官方那个「关掉最上层弹窗」的全局快捷键关不掉它（弹窗内的 Escape 正常）。
- **样式只对齐主题 token，不逐像素复制官方 CSS**：主题改版时插件的观感可能和官方有细微差别，但不会错位。
- **图标大部分引用宿主的 sprite symbol**（`dsw-icon-clock-outline-regular` 等）：主题换图标时插件跟着换，
  插件自己不带美术资源。宿主若改 symbol 命名，插件图标会变空白。
  唯一例外是日期行那颗**日历图标**：官方产品图标集里没有日历字形，官方自己也是现画的，插件连同路径一起抄了一份。
- **重复规则与官方同一套**：八种频率、间隔步进器、星期药丸、自定义规则文本，以及每种频率对应的
  RRULE 拼法，都逐条对齐官方的 `editor-timing.ts`；没有再收窄。
- **越界读取一定先问**：即使目标路径看起来无害（它必须是个能解出 session 的制品），也先要批准。

## 它怎么工作

| 部位 | 职责 |
| --- | --- |
| `cordis.patch.yml` | 往组合树里插两行，一行一个组件 |
| `packages/schedule/` | **自动化任务**组件：浏览器半（`client.js`，注册状态栏入口、调用 `ctx.remote.schedule.create`）+ 一个空的宿主入口（`index.js`，浏览器代码不能进 Node） |
| `packages/session-unpack/` | **会话解压**组件：`src/index.js`（宿主入口，注册 `unpack_session`、处理越界读取的批准）+ `src/session-unpack/`（frames / zip / paths / log / transcript / artifacts 六个模块） |
| `locale/*.json` | 每个组件包各有一份，标题与描述就是插件页上显示的那两行 |
| `icon.svg` | 插件图标 |

「自动化任务」组件的关键决定：

- **入口用 composer dock 的 slot**（`conversation.composer.dock`）：那一排本来就是当前会话的
  统计控件（轮次、token 用量），天然带当前会话身份，不需要额外的「当前会话」API。
- **用新 id 注册**（`dsh-enhance-schedule-task`，order 2，排在官方的 `activity`/`usage` 之后），
  所以是**新增**一个控件，不会顶掉官方控件。
- **门禁用 `ctx.remoteAccess.whenAccess('schedule/create', …)` 加组件里的 `useRemoteAccess('schedule/create')`**：
  `schedule/create` 是 owner-only 的全局资源端点，主人以外的对端看不到这个入口。
- **表单移植官方规则行**：字段名、行式布局、圆角与主题 token 都跟官方任务编辑器一致
  （`--dsw-alias-*`），控件是官方控件的本地副本，不 import 官方前端包。
- **时间规则用 RFC 5545 文本**，`DTSTART;TZID=<本地时区>:…` + `RRULE:`，与 dsh 官方编辑器同一套写法：
  仅一次 = `FREQ=DAILY;COUNT=1`，
  每天 = `FREQ=DAILY;INTERVAL=n;BYHOUR=…;BYMINUTE=…`，
  每周 = `FREQ=WEEKLY;INTERVAL=n;BYDAY=MO,TU,…`，
  每月 = `FREQ=MONTHLY;INTERVAL=n;BYMONTHDAY=d,-1;BYSETPOS=1`，
  每 N 小时 / 每 N 分钟 = `FREQ=HOURLY|MINUTELY;INTERVAL=n`，
  自定义 = 原样透传。
- **创建成功后开官方页签**：`ctx.sidebarRight.openTab('scheduleTask', { params: { sessionId, id } })`，
  所以打开的是这个任务的官方详情页，而不是另开一个面板。
- **表单失败时保留草稿**，只把原因翻译成一句话（时间不在未来 / 规则不合法 / 通用失败）。

## 开发

> 另有一份独立文档讲**「一个 bundle 装多个可分别启停的组件」这套模式**怎么搭、怎么装、踩过哪些坑：
> [`docs/multi-component-bundle.md`](./docs/multi-component-bundle.md)。

```sh
npm run bundle                                       # 构建两个组件到 lib/

node --check packages/schedule/src/client/index.js
node --check packages/schedule/src/index.js
node --check packages/session-unpack/src/index.js
node --check packages/session-unpack/src/session-unpack/index.js

node --test tests/client-behavior.mjs         # 客户端半行为测试
node --test tests/host-session-unpack.mjs      # 解压组件测试
node --test tests/host-tool-registration.mjs   # 工具注册与批准顺序测试
```

三个测试文件都不需要浏览器，也不需要 dsh 进程：

- `tests/client-behavior.mjs` 用一个 React 替身加载构建产物 `lib/client.js`（也就是宿主真正加载的那份），覆盖：入口注册参数、
  访问门禁、创建请求的目标会话、错误原因映射、右侧页签参数、八种频率各自的 RRULE 负载、
  表单与官方一致的行、重复菜单的选项与选中标记、日期行与时间行是自绘按钮而不是原生控件、
  月历卡片与三列时钟卡片、每天规则不带秒、以及「不加载任何 Harness Client 包」这条硬约束。
- `tests/host-session-unpack.mjs` 在磁盘上造出三种制品（多帧 zstd / 明文 jsonl / zip），
  覆盖帧扫描与解码、安装目录定位、transcript 渲染、锚点（文字与轮次号）、锚点不存在、
  三产物写出、zip 导出、纯 jsonl，以及**取消后停止**、**解压期间事件循环仍在跑**。
- `tests/host-tool-registration.mjs` 用一个假上下文驱动注册进来的工具，覆盖：注册形状、
  **越界先批准后读盘**、工作区内免问、full-access 免问、已授予目录免问、被拒后不留产物。

## License

MIT
