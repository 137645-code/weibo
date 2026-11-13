import type {
  AddPostFailureReason,
  AddPostResult,
  LoadResult,
  Post,
  PostApi,
  PostDraft,
  PostReaction,
  SetReactionResult,
} from '../types/post'
import {
  normalizeAuthor,
  normalizeAvatar,
  normalizeCount,
  normalizeFlag,
  normalizeLocation,
} from './normalize'

const DEFAULT_BASE_URL = '/api'

/** 单个请求的超时时间：挂起时宁可降级，也不让界面一直转圈 */
const DEFAULT_TIMEOUT_MS = 8000

/** 服务端错误码到失败原因的唯一映射处 */
const ERROR_REASONS: Record<string, AddPostFailureReason> = {
  EMPTY_CONTENT: 'empty',
  CONTENT_TOO_LONG: 'too-long',
  PAYLOAD_TOO_LARGE: 'too-long',
}

export interface PostApiOptions {
  /** 接口前缀，默认同源 /api */
  baseUrl?: string
  /** 可注入的 fetch 实现，便于测试与自定义传输 */
  fetchImpl?: typeof fetch
  /** 请求超时（毫秒） */
  timeoutMs?: number
}

/**
 * 逐条校验服务端返回的数据。字段不合法时丢弃该条，
 * 避免一处脏数据拖垮整个信息流。
 */
function parsePost(item: unknown): Post | null {
  if (!item || typeof item !== 'object') return null

  const raw = item as Record<string, unknown>
  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (typeof raw.content !== 'string' || raw.content.trim() === '') return null
  if (typeof raw.createdAt !== 'number' || !Number.isFinite(raw.createdAt)) return null

  return {
    id: raw.id,
    content: raw.content,
    createdAt: raw.createdAt,
    author: normalizeAuthor(raw.author),
    avatar: normalizeAvatar(raw.avatar),
    location: normalizeLocation(raw.location),
    // 旧数据可能没有互动字段，缺省即视为未点赞、未收藏
    likes: normalizeCount(raw.likes),
    liked: normalizeFlag(raw.liked),
    favorited: normalizeFlag(raw.favorited),
  }
}

function parseList(body: unknown): Post[] | null {
  if (!body || typeof body !== 'object') return null

  const raw = (body as { posts?: unknown }).posts
  if (!Array.isArray(raw)) return null

  return raw.map(parsePost).filter((post): post is Post => post !== null)
}

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown } }
    const code = body?.error?.code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

/**
 * 创建远端数据源客户端。所有异常都在内部消化：
 * 网络错误、超时、非 2xx、响应结构不符一律降级，
 * 由状态层决定如何提示，不在传输层抛错。
 */
export function createPostApi(options: PostApiOptions = {}): PostApi {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const doFetch: typeof fetch =
    options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  /** 带超时的请求：超时即中止并抛错，由调用方统一降级 */
  async function request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('request timeout')), timeoutMs)

    try {
      return await doFetch(`${baseUrl}${path}`, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async load(): Promise<LoadResult> {
      try {
        const response = await request('/posts', { headers: { Accept: 'application/json' } })

        if (!response.ok) return { list: [], ok: false }

        const list = parseList(await response.json())
        if (!list) return { list: [], ok: false }

        return { list, ok: true }
      } catch {
        return { list: [], ok: false }
      }
    },

    async setReaction(
      id: string,
      kind: PostReaction,
      active: boolean,
    ): Promise<SetReactionResult> {
      // 幂等语义：active 是目标状态，PUT 表示打开、DELETE 表示关闭
      const path = `/posts/${encodeURIComponent(id)}/${kind === 'like' ? 'like' : 'favorite'}`

      try {
        const response = await request(path, {
          method: active ? 'PUT' : 'DELETE',
          headers: { Accept: 'application/json' },
        })

        if (response.status === 404) return { ok: false, reason: 'not-found' }
        if (!response.ok) return { ok: false, reason: 'unavailable' }

        const body = (await response.json()) as { post?: unknown }
        const post = parsePost(body?.post)

        return post ? { ok: true, post } : { ok: false, reason: 'unavailable' }
      } catch {
        return { ok: false, reason: 'unavailable' }
      }
    },

    async create(draft: PostDraft): Promise<AddPostResult> {
      try {
        const response = await request('/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(draft),
        })

        if (response.ok) {
          const body = (await response.json()) as { post?: unknown }
          const post = parsePost(body?.post)
          return post ? { ok: true, post } : { ok: false, reason: 'unavailable' }
        }

        if (response.status >= 400 && response.status < 500) {
          const code = await readErrorCode(response)
          const reason = code ? ERROR_REASONS[code] : undefined
          if (reason) return { ok: false, reason }
        }

        return { ok: false, reason: 'unavailable' }
      } catch {
        return { ok: false, reason: 'unavailable' }
      }
    },
  }
}
