# dsh-enhance-session-unpack（会话解压）

给 agent 一个 `unpack_session` 工具，把一个 dsh session 解压成可读的目录：
`transcript.md` + `session.jsonl` + `meta.json`。

它属于 [dsh-enhance](../../README.md) 这个 bundle，是第二个组件，和「自动化任务」「回复提醒」
各管各的：关掉它，另两个照常工作。

中文 | [English](./README.en.md)

---

## 它解决什么问题

dsh 的 session 存在磁盘上，是一个**只追加的日志**：`session.v4.jsonl.zstd` —— 里面是**拼接的
Zstandard 帧**，每帧一次追加，一行一个 JSON 事件。Node 自带的 `zstdDecompressSync` 对这种文件
只会解出第一帧（249 字节的 header），所以普通解压工具拿到的是空的。

再加上 session 可能**不在你手边**：它在另一套安装里（`E:/dsh-desktop-portable`）、是归档导出的
zip、或者只是长会话的后半段 —— 模型在当前会话里根本看不到它。

`unpack_session` 就是干这件事的：给它一个安装目录/家目录 + session id（或者直接给一个压缩包），
它把那个 session 解成一个目录：

| 文件 | 内容 |
| --- | --- |
| `transcript.md` | 对话正文（官方 `formatSessionMarkdown` 的排版：用户消息是 `>` 引用，工具调用/结果折叠进 `<details>`，每轮收尾回复平铺） |
| `session.jsonl` | **完整**解码后的事件流（解压真相，不裁剪） |
| `meta.json` | session id、标题、来源路径、轮次数、事件数、锚点、导出时间 |

## 用法

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

`source` 支持的目录形态：`<目录>/sessions` 或 `<目录>/home/sessions`；session 日志在
`<home>/sessions/<workspace-slug>/<session-id>/session.vN.jsonl.zstd`，多代次时取新的那代。

给一个 zip 也可以：官方「导出 session 日志」产出的包里是**明文** `session.vN.jsonl`；
把 session 目录**手工打包**出来的包里是**压缩的** `session.vN.jsonl.zstd` —— 两种都认。
包里有多代次时取最新的那个。

## 越界读取要批准

这个工具的活儿就是读**当前工作区之外**的 session 日志，所以越界时它会**先问用户**
（`ctx.approval.request`），批准了才读盘。免问的情况：

- 部署本来就是 `danger-full-access`；
- 制品在本会话的工作区里；
- 制品在部署**显式授予**的目录里（`--add-dir` / `additionalWritableRoots`）；
- 本会话的批准策略是 `ask` 且用户点了允许。

注意顺序：**路径先解析、批准先要、内容后读** —— 批准没拿到之前，一个字节都不会从磁盘上读。

批准策略是 `never` 的会话（比如无头跑批）**用不了**这个工具，会明确报错而不是偷偷读。

## 它由哪些部分组成

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

- **自己扫 Zstandard 帧边界**：帧头自述布局、块头自述大小，所以不解压也能走边界；然后逐帧
  `zstdDecompress`。官方 `session-persistence-jsonl` 的 zstd.ts 也是纯字节扫描。
- **解压不阻塞宿主**：逐帧解压走 `node:zlib` 的异步接口（在 libuv 线程池里跑），事件流解析与
  transcript 渲染每 200 个事件 / 50 轮把事件循环让回宿主。
- **可取消**：每帧之间、每批事件之间检查 `exec.signal`，被取消时抛 `AbortError`，**不留下半成品目录**
  （目录在产物都备好之后才建）。
- **ZIP 自己读**：EOCD + 中央目录 + local header，异步 `inflateRaw` 解 deflate；**ZIP64 明确报错**，不猜。
  包里的日志条目可以是明文，也可以是压缩的 `.jsonl.zstd`（复用同一套帧解码）。
- **宿主半不 import 任何 Harness 包**：`ctx.tools.register` 接受纯对象（`defineTool` 只是类型辅助），
  zstd/zip 全用 `node:zlib` 手写。
- **`session.jsonl` 写完整事件流，`transcript.md` 才按锚点裁剪**：解压的真相和阅读的便利分开。
- **产物默认落临时目录**：不污染用户仓库；`out` 可以覆盖。
- **越界读取一定先问**：即使目标路径看起来无害（它必须是个能解出 session 的制品），也先要批准。

## 依赖的宿主契约

- `ctx.tools.register`：注册工具；
- `ctx.approval`：越界读取的批准。

## 构建与测试

```sh
cd packages/session-unpack
npm install
npm run bundle          # 产物在 lib/（不进版本库）
```

测试在仓库根目录：

```sh
node --test tests/host-session-unpack.mjs      # 解压本身
node --test tests/host-tool-registration.mjs   # 工具注册与批准顺序
```

`host-session-unpack.mjs` 在磁盘上造出三种制品（多帧 zstd / 明文 jsonl / zip），覆盖帧扫描与解码、
安装目录定位、transcript 渲染、锚点（文字与轮次号）、锚点不存在、三产物写出、zip 导出、
**zip 里装的是压缩日志**、**zip 里有多个代次时取最新**、纯 jsonl，
以及**取消后停止**、**解压期间事件循环仍在跑**。

`host-tool-registration.mjs` 用一个假上下文驱动注册进来的工具，覆盖注册形状、
**越界先批准后读盘**、工作区内免问、full-access 免问、已授予目录免问、被拒后不留产物。

## License

MIT
