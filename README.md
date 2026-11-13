# Spark · 星火

一个极简的本地信息流应用：发布动态、按时间倒序浏览，数据只保存在你自己的浏览器里。

- **技术栈**：Node.js + Vite + Vue 3（Composition API + `<script setup>`）+ TypeScript + Pinia
- **数据存储**：浏览器 LocalStorage，键名 `feed_posts_v1`，与旧版完全兼容
- **开发方式**：TDD（测试先行的红 → 绿 → 重构），测试覆盖工具层、状态层、组件层与整体集成
- **无后端、无账号**，所有内容只存在本机

## 运行方式

需要 Node.js ≥ 22.12（Vite 8 的最低要求）。

```bash
npm install
npm run dev        # 本地开发，默认 http://localhost:5173
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run preview    # 预览构建产物
```

## 测试

```bash
npm test           # 单次运行全部单元 + 组件 + 集成测试
npm run test:watch # 监听模式，TDD 开发时使用
npm run test:coverage # 生成覆盖率报告（coverage/）
npm run typecheck  # vue-tsc 类型检查
```

当前规模：**13 个测试文件 / 100 个用例**，全部通过。

| 层次 | 测试文件 | 覆盖内容 |
| --- | --- | --- |
| 纯函数 | `utils/__tests__/normalize.spec.ts` | 昵称、头像索引、地点的归一化与边界值 |
| 纯函数 | `utils/__tests__/format.spec.ts` | 时间格式化补零、非法时间、头像路径补零 |
| 纯函数 | `utils/__tests__/geo.spec.ts` | 球面距离、最近城市匹配、200km 阈值 |
| 纯函数 | `utils/__tests__/post.spec.ts` | 动态构造、空正文、id 生成、注入时钟 |
| 持久化 | `utils/__tests__/storage.spec.ts` | 脏数据过滤、兼容旧数据、JSON 损坏、配额失败 |
| 状态 | `stores/__tests__/feed.spec.ts` | 初始化、倒序派生、发布校验、写入失败降级 |
| 能力 | `composables/__tests__/useGeolocation.spec.ts` | 无 API、拒绝授权、超时异常、命中/未命中 |
| 组件 | `components/__tests__/*.spec.ts` | 品牌区、提示条、发布区交互、单条卡片、列表与空状态 |
| 集成 | `__tests__/App.spec.ts` | 首屏读取、发布流程、存储降级、定位全链路 |

## TDD 实践

实现按「由内向外」分层推进，每一层都先写断言、确认失败，再写实现：

1. **工具层**：`normalize` / `format` / `geo` / `post` / `storage`。纯函数与持久化契约先行，用测试锁定旧版全部业务规则（截断长度、越界回落、脏数据过滤、异常降级）。
2. **状态层**：`stores/feed.ts`。测试直接操作真实 Pinia 实例与 `localStorage`，验证倒序派生、空内容拒绝、写入失败保留内存数据。
3. **组件层**：`AppHeader` / `StorageNotice` / `PostComposer` / `PostItem` / `PostFeed`。以可访问性与样式类名作为断言依据（黑盒），不依赖内部实现细节。
4. **集成层**：`App.spec.ts`。从「打开页面 → 发布 → 刷新读取 → 定位降级」跑通完整链路。

可测性的两个关键设计：

- **依赖注入**：`createPostStorage(storage?)` 接受任意 `Storage` 实现；`createPost(draft, { now, random })` 接受时钟与随机源。测试无需污染全局，也无需 mock 计时器即可断言 id 生成与写入失败路径。
- **结果对象代替抛错**：存储读写返回 `{ list, ok }` / `boolean`，发布返回 `{ ok: true, post } | { ok: false, reason }`。状态层不感知 UI 文案，提示文案由组件决定。

## 功能

| 功能 | 说明 |
| --- | --- |
| 发布动态 | 顶部输入框填写文本，点击「发布」新增一条 |
| 作者昵称 | 发布时可填写昵称（最多 20 字），留空显示「匿名用户」 |
| 头像 | 内置 10 张插画头像供单选，选中状态随动态保存 |
| 发布地点 | 浏览器定位后自动匹配城市名，获取失败则该条不显示地点 |
| 信息流展示 | 所有动态按发布时间倒序排列，最新在最上 |
| 本地持久化 | 刷新页面、重启浏览器后数据仍在 |
| 单条展示 | 显示头像、昵称、发布时间、地点（有则显示）与文本内容 |

发布后只清空正文，昵称与头像选择保留，方便连续发布。

## 不做的功能

为保证最小可用，以下均**未实现**：评论、点赞、删除、图片上传、用户登录、深色模式、分页、分享、搜索、话题标签。

## 目录结构

```
.
├── index.html                  # Vite 入口
├── vite.config.ts              # Vite + Vitest 统一配置
├── tsconfig.app.json           # 应用侧 TS 配置（strict）
├── tsconfig.node.json          # 构建脚本 TS 配置
├── public/avatars/             # 10 张本地头像 avatar-01.jpg … avatar-10.jpg
├── legacy/index.html           # 旧版单文件原生实现（归档对照，可直接双击运行）
└── src/
    ├── main.ts                 # 创建应用、挂载 Pinia、引入全局样式
    ├── App.vue                 # 页面骨架：装饰光斑 + 品牌区 + 提示条 + 发布区 + 信息流
    ├── styles/main.css         # 设计令牌、渐变背景、卡片、胶囊按钮、响应式
    ├── types/post.ts           # Post / PostStorage / AddPostResult 等类型契约
    ├── constants/feed.ts       # 存储键、长度上限、文案常量
    ├── utils/                  # normalize / format / storage / post / geo
    ├── composables/            # useGeolocation
    ├── stores/feed.ts          # Pinia store
    └── components/             # AppHeader / StorageNotice / PostComposer / PostItem / PostFeed
```

测试文件与源码同目录放置在 `__tests__/`，命名 `*.spec.ts`。

## 数据结构

存储键：`localStorage['feed_posts_v1']`，值为 JSON 数组，每个元素：

```json
{
  "id": "lq3k9f_8x2b1c",
  "content": "今天的第一条动态",
  "createdAt": 1763000000000,
  "author": "林一",
  "avatar": 2,
  "location": "上海"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一标识，由时间戳 36 进制与随机串拼接 |
| `content` | string | 动态正文（已去除首尾空白） |
| `createdAt` | number | 毫秒时间戳，用于倒序排序与展示格式化 |
| `author` | string | 昵称，读取时归一化，空值回落为「匿名用户」 |
| `avatar` | number | 头像索引 0~9，非法值回落为 0 |
| `location` | string \| null | 城市名，`null` 表示未获取到，渲染时不显示 |

`author` / `avatar` / `location` 为后加的可选字段：旧数据缺少这些字段时，读取阶段统一补默认值，不需要迁移存储键。旧版页面与新版本读写的是同一份数据，可互相打开。

## 头像与定位说明

- **头像**：10 张几何插画头像存放在 `public/avatars/avatar-01.jpg … avatar-10.jpg`（256×256、JPEG），页面用相对路径引用，不依赖任何外链；发布区用原生 radio 单选，选择结果只保存索引值，越界自动回落到第 1 张。
- **图片兜底**：头像加载失败时隐藏图片，由容器的淡蓝粉渐变兜底，不会出现破图。
- **地点**：页面挂载后通过 `navigator.geolocation` 请求定位（需用户授权），拿到经纬度后与内置的城市坐标表做 Haversine 最近距离匹配，200km 内命中即显示城市名，例如「上海」；发布区会提示「定位中… / 已定位：上海 / 位置不可用」。
- **降级策略**：拒绝授权、超时（8 秒）或坐标超出所有已知城市范围时，状态显示「位置不可用」，该条动态不显示地点，页面其余功能不受影响。
- **近似性**：坐标表只覆盖主要城市，县级地区会显示邻近的大中城市名。定位结果不写入 LocalStorage，只随单条动态保存城市名，不保存原始经纬度。

## 健壮性

- 读取与写入 LocalStorage 均由 `try / catch` 包裹，解析失败或存储被禁用时降级为空列表，不会抛出错误。
- 解析后逐条校验字段类型，自动过滤损坏数据，并为缺失的昵称 / 头像 / 地点字段补默认值。
- 写入失败（隐私模式、配额超限）时页面顶部显示提示条，内容在本次会话内仍可正常查看。
- 用户文本统一通过 Vue 插值渲染，不使用 `v-html`，避免标签注入；定位全程异常捕获，失败仅降级不报错。

## 旧版归档

`legacy/index.html` 保留了重构前的单文件原生实现（头像路径已改为指向 `../public/avatars/`），可直接双击对照运行。新版本行为以其为基准逐条迁移，并由测试固化。

## 浏览器兼容

支持 Chrome、Edge、Firefox、Safari 等现代浏览器。`file://` 方式打开时部分浏览器对 LocalStorage 有限制，开发环境请使用 `npm run dev` 或预览构建产物。
