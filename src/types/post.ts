/**
 * 单条动态。字段与旧版 LocalStorage 数据结构保持完全一致，
 * 保证旧数据可直接读取，无需迁移。
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

/** 读取结果；ok 表示存储本身是否可用，而非是否存在数据 */
export interface LoadResult {
  list: Post[]
  ok: boolean
}

/** 持久化契约：失败不抛错，用返回值表达 */
export interface PostStorage {
  load(): LoadResult
  save(list: Post[]): boolean
}

/** 发布结果：状态层只表达成败与原因，不携带任何 UI 文案 */
export type AddPostResult =
  | { ok: true; post: Post }
  | { ok: false; reason: 'empty' }

/** 定位状态：idle 未开始、locating 请求中、ready 命中城市、unavailable 不可用 */
export type LocationStatus = 'idle' | 'locating' | 'ready' | 'unavailable'

/** 定位请求的终态结果 */
export interface LocateResult {
  location: string | null
  status: 'ready' | 'unavailable'
}
