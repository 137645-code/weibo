import { STORAGE_KEY } from '@/constants/feed'
import type { LoadResult, Post, PostStorage } from '@/types/post'
import { normalizeAuthor, normalizeAvatar, normalizeLocation } from './normalize'

/**
 * 解析单条历史数据。字段不合法时返回 null，由调用方过滤。
 */
function parsePost(item: unknown, index: number): Post | null {
  if (!item || typeof item !== 'object') return null

  const raw = item as Record<string, unknown>
  if (typeof raw.content !== 'string' || raw.content.trim() === '') return null
  if (typeof raw.createdAt !== 'number' || !Number.isFinite(raw.createdAt)) return null

  return {
    id: String(raw.id || `${raw.createdAt}_${index}`),
    content: raw.content,
    createdAt: raw.createdAt,
    author: normalizeAuthor(raw.author),
    avatar: normalizeAvatar(raw.avatar),
    location: normalizeLocation(raw.location),
  }
}

function resolveDefaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // 隐私模式下访问 localStorage 本身就可能抛错
    return null
  }
}

/**
 * 创建持久化对象。读取与写入的异常都在内部消化，
 * 通过返回值表达结果，调用方无需 try/catch。
 *
 * @param storage 可注入的 Storage，默认使用浏览器 localStorage；传 null 表示不可用
 */
export function createPostStorage(storage: Storage | null = resolveDefaultStorage()): PostStorage {
  return {
    load(): LoadResult {
      if (!storage) return { list: [], ok: false }

      try {
        const raw = storage.getItem(STORAGE_KEY)
        if (!raw) return { list: [], ok: true }

        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return { list: [], ok: true }

        const list: Post[] = []
        parsed.forEach((item, index) => {
          const post = parsePost(item, index)
          if (post) list.push(post)
        })

        return { list, ok: true }
      } catch {
        // 存储被禁用或 JSON 损坏时，以空列表继续
        return { list: [], ok: false }
      }
    },

    save(list: Post[]): boolean {
      if (!storage) return false

      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(list))
        return true
      } catch {
        // 配额超限或存储被禁用，交由调用方展示提示
        return false
      }
    },
  }
}
