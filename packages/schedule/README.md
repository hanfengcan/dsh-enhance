# dsh-enhance-schedule（自动化任务）

在输入框下方的状态栏里，为**当前对话**创建一个自动化任务，并直接打开官方右侧任务页签。

它属于 [dsh-enhance](../../README.md) 这个 bundle，是第一个组件，和「会话解压」「回复提醒」
各管各的：关掉它，另两个照常工作。

中文 | [English](./README.en.md)

---

## 它解决什么问题

dsh 自带的「新建自动化任务」只能建**新会话**或**一次性新会话**的任务：任务到了时间会开一个新对话去做事。
但很多场景不是这样 —— 套餐额度用光、等下个周期时，你想把活**排进眼下这个会话**，让结果直接落在这个对话里。

这个组件补上这个缺口：在输入框下方的状态栏点一个「定时任务」，填一张表（任务名称 / 任务内容 / 时间），
任务就绑定在**这个会话**上，到点由这个会话接着做。典型用法是「额度恢复后继续当前未完成的工作」。

任务本身仍然是 dsh 原生的自动化任务：它出现在官方「自动化任务」面板、会话头部的任务目录徽标里，
可以在官方右侧页签里查看、编辑、立即执行、删除。插件只是**新建的入口**，不另造一套任务系统。

## 特点

- **零歧义**：入口就在当前会话的状态栏里，绑定的就是屏幕上这个会话，没有会话选择器，也不会误绑到别的对话。
- **界面与官方一致**：弹窗是官方任务编辑器的一份移植（行式规则、执行位置 / 运行时间：重复·间隔·星期·日期·时间·时区），
  建完就直接落到官方任务详情页，编辑、立即执行、删除都在官方界面里。
- **不加载官方前端包**：插件**自带**弹窗、按钮、输入框、下拉菜单、月历卡片与时钟卡片的实现，
  不 import 任何 Harness Client 包（官方插件规范的要求），因此不会和 dsh 版本的前端包实现打架。
- **不改动 dsh 源码**：纯插件实现，升级 dsh 不用打补丁。
- **运行时零依赖**：产物里只有 Node 自带模块，没有第三方运行时依赖；源码用 tsdown 构建成 `lib/`。

## 怎么用

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

## 它由哪些部分组成

| 部位 | 职责 |
| --- | --- |
| `src/client/index.js` | 注册状态栏入口、访问门禁、创建请求与右侧页签 |
| `src/client/components/dock-entry.js` | 输入框下方状态栏里的那个入口 |
| `src/client/components/create-task-dialog.js` | 新建任务的弹窗 |
| `src/client/components/task-editor.js` | 弹窗的表单主体 |
| `src/client/components/rule-rows.js` | 重复 / 间隔 / 星期 / 日期 / 时间 / 时区各行 |
| `src/client/components/date-picker.js` | 自绘的月历卡片 |
| `src/client/components/clock-picker.js` | 自绘的时 / 分 / 秒三列时钟卡片 |
| `src/client/components/primitives.js` | 自绘的按钮、输入框、下拉菜单等基础控件 |
| `src/client/schedule-format.js` | 把表单里的规则拼成一份 DTSTART + RRULE |
| `src/client/time-zones.js` | 以选中时区算出「现在」，给按分钟 / 按小时的间隔当锚点 |
| `src/client/icons.js` | 用宿主 sprite symbol 画产品图标 |
| `src/client/id-counter.js` | 给规则行自造的控件发互不重复的 id |
| `src/client/hooks.js` | 弹窗里的键盘焦点管理 |
| `src/client/locales.js` | 这个组件的文案 |
| `src/client/styles.js` | 这个组件自己的皮肤，只用 `--dsw-*` 主题 token |
| `src/index.js` | 宿主半（空入口，浏览器代码不能进 Node） |

几个关键决定：

- **入口用 composer dock 的 slot**（`conversation.composer.dock`）：那一排本来就是当前会话的
  统计控件（轮次、token 用量），天然带当前会话身份，不需要额外的「当前会话」API。
- **用新 id 注册**（`dsh-enhance-schedule-task`，order 2，排在官方的 `activity`/`usage` 之后），
  所以是**新增**一个控件，不会顶掉官方控件。
- **门禁用 `ctx.remoteAccess.whenAccess('schedule/create', …)` 加组件里的
  `useRemoteAccess('schedule/create')`**：`schedule/create` 是 owner-only 的全局资源端点，
  主人以外的对端看不到这个入口。
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
- **弹窗不进官方的全局 modal 栈**：插件的弹窗是自己画的，只和**自己叠的**下拉菜单争 Escape 与 Tab；
  官方那个「关掉最上层弹窗」的全局快捷键关不掉它（弹窗内的 Escape 正常）。
- **图标大部分引用宿主的 sprite symbol**（`dsw-icon-clock-outline-regular` 等）：主题换图标时插件跟着换，
  插件自己不带美术资源。宿主若改 symbol 命名，插件图标会变空白。
  唯一例外是日期行那颗**日历图标**：官方产品图标集里没有日历字形，官方自己也是现画的，插件连同路径一起抄了一份。
- **重复规则与官方同一套**：八种频率、间隔步进器、星期药丸、自定义规则文本，以及每种频率对应的
  RRULE 拼法，都逐条对齐官方的 `editor-timing.ts`；没有再收窄。

## 依赖的宿主契约

- `conversation.composer.dock` 这个 slot；
- `remote.schedule.create` 这个端点（走 `ctx.remoteAccess` 的 `schedule/create` 门禁）；
- `sidebarRight.openTab('scheduleTask')` 这个官方页签 kind。

宿主改了这三样里的任何一个，这个组件都要跟着改。

## 构建与测试

```sh
cd packages/schedule
npm install
npm run bundle          # 产物在 lib/（不进版本库）
```

测试在仓库根目录：

```sh
node --test tests/client-behavior.mjs
```

用一个 React 替身加载构建产物 `lib/client.js`（也就是宿主真正加载的那一份），覆盖：入口注册参数、
访问门禁、创建请求的目标会话、错误原因映射、右侧页签参数、八种频率各自的 RRULE 负载、
表单与官方一致的行、重复菜单的选项与选中标记、日期行与时间行是自绘按钮而不是原生控件、
月历卡片与三列时钟卡片、每天规则不带秒、以及「不加载任何 Harness Client 包」这条硬约束。

## License

MIT
