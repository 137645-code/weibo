/**
 * 单条动态。字段在前后端之间共用，服务端负责构造与归一化，
 * 前端只做展示与宽松校验。
 */
export interface Post {
  id: string
  content: string
  createdAt: number
  author: string
  avatar: number
  location: string | null
}

/** 发布动态时的原始输入，允许缺省与脏值，由归一化函数兜底 */
export interface PostDraft {
  content: string
  author?: string | null
  avatar?: number | string | null
  location?: string | null
}

/** 读取结果；ok 表示服务端是否可用，而非是否存在数据 */
export interface LoadResult {
  list: Post[]
  ok: boolean
}

/** 发布失败原因：状态层只表达原因，不携带任何 UI 文案 */
export type AddPostFailureReason = 'empty' | 'too-long' | 'unavailable'

/** 发布结果 */
export type AddPostResult = { ok: true; post: Post } | { ok: false; reason: AddPostFailureReason }

/** 远端数据源契约：失败不抛错，用返回值表达 */
export interface PostApi {
  load(): Promise<LoadResult>
  create(draft: PostDraft): Promise<AddPostResult>
}

/** 定位状态：idle 未开始、locating 请求中、ready 命中城市、unavailable 不可用 */
export type LocationStatus = 'idle' | 'locating' | 'ready' | 'unavailable'

/** 定位请求的终态结果 */
export interface LocateResult {
  location: string | null
  status: 'ready' | 'unavailable'
}
