import type { Post, PostDraft } from '../types/post'
import { normalizeAuthor, normalizeAvatar, normalizeLocation } from './normalize'

/** 可注入的时钟与随机源，便于测试得到确定结果 */
export interface CreatePostDeps {
  now?: () => number
  random?: () => number
}

/** 由时间戳 36 进制与随机串拼接出唯一标识 */
export function createPostId(createdAt: number, randomValue: number): string {
  return `${createdAt.toString(36)}_${randomValue.toString(36).slice(2, 8)}`
}

/**
 * 由草稿构造一条完整动态。
 * 正文去除首尾空白后为空时返回 null，其余字段一律归一化。
 */
export function createPost(draft: PostDraft, deps: CreatePostDeps = {}): Post | null {
  const content = typeof draft.content === 'string' ? draft.content.trim() : ''
  if (!content) return null

  const now = deps.now ?? Date.now
  const random = deps.random ?? Math.random
  const createdAt = now()

  return {
    id: createPostId(createdAt, random()),
    content,
    createdAt,
    author: normalizeAuthor(draft.author),
    avatar: normalizeAvatar(draft.avatar),
    location: normalizeLocation(draft.location),
    // 新动态的互动状态由服务端单独维护，构造时始终从零开始
    likes: 0,
    liked: false,
    favorited: false,
  }
}
