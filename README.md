# Spark · 星火

一个极简的信息流应用：发布动态、按时间倒序浏览、点赞与收藏。数据不再存在浏览器里，而是通过 **Hono + RESTful API + 内存存储** 的后端服务统一读写。

- **前端**：Vue 3（Composition API + `<script setup>`）+ TypeScript + Pinia + Vite
- **后端**：Hono（路由）+ `@hono/node-server`（运行时）+ 进程内内存存储
- **数据流**：组件 → Pinia store → `fetch` → `/api/posts` → 内存仓储；前端不再接触 LocalStorage
- **互动**：点赞（计数 + 是否已赞）与收藏（是否已收藏），幂等接口 + 乐观更新 + 失败回滚
- **开发方式**：TDD（红 → 绿 → 重构），单测 / 契约测 / 组件测 / 集成测 / 真实浏览器验收

## 运行方式

需要 Node.js ≥ 22.12（Vite 8 的最低要求）。

```bash
npm install
npm run dev        # 前端 + /api 同一端口：http://localhost:5173
npm run server     # 独立后端进程：http://localhost:8787（有 dist 时同时托管前端）
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run preview    # 预览构建产物（同样带 /api）
```

开发与预览模式下，Hono 应用以 **Vite 中间件** 的形式挂在同一个端口上（见 `server/vite-plugin.ts`），因此不需要第二个进程、不需要配置代理，前端始终用同源相对路径 `/api` 请求。

生产部署时 `npm run server` 会启动 `server/index.ts`：先挂 `/api` 路由，再把 `dist/` 作为静态资源与 SPA 兜底（`/api/*` 的 404 不会被 `index.html` 吞掉，见 `server/serverApp.ts`）。

## 测试

```bash
npm test              # 单次运行全部单元 / 契约 / 组件 / 集成测试
npm run test:watch    # 监听模式，TDD 开发时使用
npm run test:coverage # 覆盖率报告（coverage/）
npm run typecheck     # 前端（vue-tsc）+ 服务端（tsc）双份类型检查
```

当前规模：**16 个测试文件 / 207 个用例**，全部通过。

| 层次 | 测试文件 | 覆盖内容 |
| --- | --- | --- |
| 内存仓储 | `server/__tests__/store.spec.ts` | 倒序与同毫秒次序、副本隔离、id 去重、点赞幂等与计数边界、收藏切换、seed/reset/count |
| HTTP 契约 | `server/__tests__/app.spec.ts` | 状态码、`Location` 头、错误码、405/413/415、互动路由 404/405 与 `Allow`、500 兜底 |
| 生产装配 | `server/__tests__/serverApp.spec.ts` | `/api` 404 与 SPA 兜底的边界、静态资源回落 |
| 传输层 | `src/utils/__tests__/api.spec.ts` | 脏数据过滤、超时降级、4xx 错误码映射、baseUrl 归一化、互动字段解析与 PUT/DELETE |
| 状态层 | `src/stores/__tests__/feed.spec.ts` | 异步首屏、加载与发布交错、并发提交、服务恢复、定位状态、乐观更新与回滚、收藏筛选 |
| 纯函数 | `src/utils/__tests__/{normalize,format,geo,post}.spec.ts` | 归一化（含计数/布尔）、时间格式化、城市匹配、动态构造 |
| 能力 | `src/composables/__tests__/useGeolocation.spec.ts` | 无 API、拒绝授权、超时、命中/未命中 |
| 组件 | `src/components/__tests__/*.spec.ts` | 品牌区、提示条、发布区、单条卡片的互动栏、筛选器与失败提示 |
| 集成 | `src/__tests__/App.spec.ts` | 首屏读取、发布链路、点赞/收藏全链路（含刷新后仍保持）、服务不可用降级、定位全链路 |

测试替身不手写 fetch mock：`src/test/fakeServer.ts` 直接把**真实的 Hono 应用**接到全局 `fetch` 上，前端测试跑的是完整 HTTP 契约；服务端测试用 `// @vitest-environment node` 直接 `app.request()`。

## API

所有响应都是 JSON。成功返回资源体，失败统一返回 `{ "error": { "code": string, "message": string } }`，`message` 只面向开发者，UI 文案由前端按 `code` 决定。

| 方法 | 路径 | 说明 | 成功 |
| --- | --- | --- | --- |
| GET | `/api/health` | 服务健康与当前条数 | 200 `{ status, storage, posts }` |
| GET | `/api/posts` | 全部动态，按时间倒序 | 200 `{ posts, total }` |
| GET | `/api/posts/:id` | 单条动态 | 200 `{ post }` |
| POST | `/api/posts` | 发布动态（JSON 请求体） | 201 `{ post }` + `Location` 头 |
| PUT | `/api/posts/:id/like` | 点赞（幂等） | 200 `{ post }` |
| DELETE | `/api/posts/:id/like` | 取消点赞（幂等） | 200 `{ post }` |
| PUT | `/api/posts/:id/favorite` | 收藏（幂等） | 200 `{ post }` |
| DELETE | `/api/posts/:id/favorite` | 取消收藏（幂等） | 200 `{ post }` |

互动接口表达的是**目标状态**而非取反：重复 `PUT` 不会把点赞数刷高，重复 `DELETE` 也不会出现负数，网络重试天然安全。

发布请求：

```bash
curl -X POST http://localhost:5173/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"content":"今天的第一条动态","author":"林一","avatar":2,"location":"上海"}'
```

错误码：

| code | HTTP | 触发条件 |
| --- | --- | --- |
| `EMPTY_CONTENT` | 400 | 正文缺失或去空白后为空 |
| `CONTENT_TOO_LONG` | 400 | 正文超过 500 字 |
| `INVALID_BODY` | 400 | 请求体不是合法 JSON 或不是对象 |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体超过 16KB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | `Content-Type` 不是 `application/json` |
| `NOT_FOUND` | 404 | 资源或路由不存在 |
| `METHOD_NOT_ALLOWED` | 405 | 路径存在但方法不支持（含 `Allow` 头） |
| `INTERNAL_ERROR` | 500 | 未捕获异常 |

前端按错误码映射为失败原因：`empty` / `too-long` / `unavailable`，组件据此选择提示文案，状态层不持有任何 UI 文案。

## 数据结构

```json
{
  "id": "lq3k9f_8x2b1c",
  "content": "今天的第一条动态",
  "createdAt": 1763000000000,
  "author": "林一",
  "avatar": 2,
  "location": "上海",
  "likes": 12,
  "liked": true,
  "favorited": false
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一标识，时间戳 36 进制 + 随机串；撞号时自动加后缀 |
| `content` | string | 正文（已去除首尾空白） |
| `createdAt` | number | 毫秒时间戳，倒序排序与展示格式化的依据 |
| `author` | string | 昵称，最多 20 字，空值回落「匿名用户」 |
| `avatar` | number | 头像索引 0~9，越界回落 0 |
| `location` | string \| null | 城市名，`null` 时前端不展示 |
| `likes` | number | 点赞总数，非负整数；与 `liked` 保持一致 |
| `liked` | boolean | 当前访客是否已点赞；无鉴权，服务端按单一访客维护 |
| `favorited` | boolean | 当前访客是否已收藏 |

归一化与构造只有一处实现（`src/utils/post.ts` / `src/utils/normalize.ts`），服务端写入时调用；前端在解析响应时做一次宽松校验，字段不合法的那一条会被丢弃而不是拖垮整个列表。

## TDD 实践

实现按「由内向外」推进，每层都先写断言、确认失败，再写实现：

1. **内存仓储**：`createPostStore()` 先由测试定义契约（倒序、副本、id 唯一），再实现。
2. **HTTP 契约**：先用 `app.request()` 断言状态码、`Location`、错误码、405/413/415，再实现路由与 `bodyLimit`。
3. **生产装配**：先用临时 `dist/` 断言「`/api` 的 404 不会被 SPA 兜底吞成 200 HTML」，再实现 `createServerApp()`。
4. **传输层**：注入 `fetchImpl` 断言错误码映射、超时降级、`baseUrl` 归一化，再实现 `createPostApi()`。
5. **状态层**：用真实 Hono 应用驱动，断言首屏加载、发布、加载与发布交错不丢数据、服务恢复后 `apiOk` 复位。
6. **互动接口**：先写幂等与边界断言（重复 `PUT` 不重复计数、重复 `DELETE` 不为负、未知 id 404、方法不支持 405 + `Allow`、脏 seed 归一化），再实现仓储与路由。
7. **互动交互**：状态层先写「乐观更新 → 在途保护 → 失败字段级回滚 → 刷新不覆盖在途意图」，组件层再断言 `aria-pressed`、禁用态与文案切换。
8. **组件层**：黑盒断言可访问性与类名，异步提交用微任务刷新而不是假计时器与 `setTimeout` 硬等。
9. **浏览器验收**：用真实 Chromium 跑「空态 → 发布 → 点赞 → 收藏 → 刷新仍存在 → 收藏筛选」全链路。

可测性的关键设计：

- **依赖注入**：`createApp({ store })` 接受任意仓储实现；`createPostApi({ fetchImpl, baseUrl, timeoutMs })` 接受传输层替身；`createPostStore({ now, random })` 接受时钟与随机源。
- **结果对象代替抛错**：传输层用 `{ list, ok }` / `{ ok, post | reason }` 表达结果，网络异常、超时、结构不符一律降级，调用方无需 `try/catch`。
- **并发保护**：`init()` 用自增序号只接受最后一次响应，并按 id 合并本地新增；`submitting` 用计数器而非布尔，避免并发发布提前解除禁用。

## 目录结构

```
.
├── index.html                  # Vite 入口（内联 SVG favicon，无外部资源）
├── vite.config.ts              # Vite + Vitest 统一配置，挂载 server/vite-plugin
├── tsconfig.app.json           # 前端 TS 配置（strict）
├── tsconfig.node.json          # 构建脚本 + server/ 的 TS 配置
├── public/avatars/             # 10 张本地头像 avatar-01.jpg … avatar-10.jpg
├── legacy/index.html           # 旧版单文件原生实现（归档，不参与构建与类型检查）
├── server/
│   ├── app.ts                  # Hono 应用：RESTful 路由、校验、错误码
│   ├── store.ts                # 内存仓储（进程内单例，重启清空）
│   ├── serverApp.ts            # 生产装配：API + dist 静态资源与 SPA 兜底
│   ├── vite-plugin.ts          # dev / preview 下把 Hono 挂到 Vite 中间件
│   ├── index.ts                # 独立后端进程入口（PORT，默认 8787）
│   └── __tests__/              # 仓储、HTTP 契约、生产装配测试
└── src/
    ├── main.ts                 # 创建应用、挂载 Pinia、引入全局样式
    ├── App.vue                 # 页面骨架 + 首屏异步加载与定位
    ├── styles/main.css         # 设计令牌、渐变背景、卡片、胶囊按钮、响应式
    ├── types/post.ts           # Post / PostApi / AddPostResult 等类型契约
    ├── constants/feed.ts       # 长度上限、提示文案常量
    ├── utils/                  # api（HTTP 客户端）/ post / normalize / format / geo
    ├── composables/             # useGeolocation
    ├── stores/feed.ts          # Pinia store（异步数据源、并发保护）
    ├── test/                   # fakeServer（真实 Hono + fetch 适配器）、setup
    └── components/             # AppHeader / ServerNotice / PostComposer / PostItem / PostFeed
```

测试文件与源码同目录放在 `__tests__/`，命名 `*.spec.ts`。

## 健壮性

- 传输层：请求 8 秒超时后主动中止并降级；非 2xx、响应结构不符、网络异常都不抛错。
- 首屏：加载期间不展示「还没有内容」，避免空状态闪烁；服务不可用时顶部提示条说明原因，页面其余功能仍可浏览。
- 服务端：请求体 16KB 上限、只接受 JSON、正文长度与类型校验、路径存在但方法不支持回 405，未知路由回 JSON 404，未捕获异常回 500 且只记日志。
- 并发：首屏加载的旧快照不会覆盖刚发布的动态；发布中禁用按钮并在入口做重入保护。
- 渲染：用户文本一律 Vue 插值，无 `v-html`；头像走索引校验，加载失败时由渐变兜底。

## 已知边界与不做的事

- **内存存储**：数据只存在当前进程，重启即清空；多实例之间不共享。这是本次替换的刻意取舍，换成数据库时只需实现同一个 `PostStore` 契约。
- **互动无鉴权**：没有登录体系，服务端按「单一访客」维护 `liked` / `favorited`，所有人看到的是同一份互动状态；接入账号后需要把这两个字段改为按用户维度存储。
- 无分页 / 无上限：`GET /api/posts` 返回全量，数据量增长后需要补分页。
- 为保证最小可用，以下均**未实现**：删除/编辑动态、评论、图片上传、用户登录、搜索、话题标签、限流与鉴权。
- `legacy/index.html` 是 LocalStorage 时代的单文件实现，仅作对照归档，读写的是浏览器本地数据，与新版本不共享数据。

## 浏览器兼容

支持 Chrome、Edge、Firefox、Safari 等现代浏览器（需要 `fetch`、`AbortController`）。开发与验收请使用 `npm run dev` 或 `npm run preview`，不要用 `file://` 直接打开。
