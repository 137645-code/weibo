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
  /** 点赞总数 */
  likes: number
  /** 当前访客是否已点赞（服务端无鉴权，视为单一访客） */
  liked: boolean
  /** 当前访客是否已收藏 */
  favorited: boolean
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

/** 可以切换的互动类型：点赞与收藏 */
export type PostReaction = 'like' | 'favorite'

/** 互动失败原因：not-found 表示目标动态已被删除 */
export type SetReactionFailureReason = 'unavailable' | 'not-found'

/** 互动结果；ok 时返回服务端的最新动态（含最新计数） */
export type SetReactionResult =
  | { ok: true; post: Post }
  | { ok: false; reason: SetReactionFailureReason }

/** 远端数据源契约：失败不抛错，用返回值表达 */
export interface PostApi {
  load(): Promise<LoadResult>
  create(draft: PostDraft): Promise<AddPostResult>
  /** 设置互动状态（幂等）：active 为目标状态而非取反 */
  setReaction(id: string, kind: PostReaction, active: boolean): Promise<SetReactionResult>
}

/** 定位状态：idle 未开始、locating 请求中、ready 命中城市、unavailable 不可用 */
export type LocationStatus = 'idle' | 'locating' | 'ready' | 'unavailable'

/** 定位请求的终态结果 */
export interface LocateResult {
  location: string | null
  status: 'ready' | 'unavailable'
}
