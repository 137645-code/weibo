import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { MAX_CONTENT_LENGTH } from '../src/constants/feed'
import type { Post, PostDraft } from '../src/types/post'
import { createPostStore, type PostStore } from './store'

/** 请求体上限：正文上限 500 字，留足昵称、地点与 JSON 结构开销 */
const MAX_BODY_BYTES = 16 * 1024

export interface CreateAppOptions {
  /** 可注入的存储，默认创建独立的内存存储 */
  store?: PostStore
}

/** 服务端只回错误码与开发向文案，UI 文案由前端按错误码决定 */
interface ApiErrorBody {
  error: { code: string; message: string }
}

function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } }
}

/** 把请求体里的脏值收敛成草稿，具体归一化交给 createPost */
function toDraft(raw: Record<string, unknown>, content: string): PostDraft {
  return {
    content,
    author: typeof raw.author === 'string' ? raw.author : null,
    avatar: typeof raw.avatar === 'number' || typeof raw.avatar === 'string' ? raw.avatar : null,
    location: typeof raw.location === 'string' ? raw.location : null,
  }
}

/**
 * 创建 Hono 应用。与运行环境无关：开发时挂在 Vite 中间件上，
 * 生产时由 @hono/node-server 承载，测试时直接用 app.request 调用。
 */
export function createApp(options: CreateAppOptions = {}): Hono {
  const store = options.store ?? createPostStore()
  const app = new Hono()

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', storage: 'memory', posts: store.count() }),
  )

  app.get('/api/posts', (c) => {
    const posts = store.list()
    return c.json({ posts, total: posts.length })
  })

  app.get('/api/posts/:id', (c) => {
    const post = store.find(c.req.param('id'))
    if (!post) return c.json(errorBody('NOT_FOUND', 'post not found'), 404)

    return c.json({ post })
  })

  app.post(
    '/api/posts',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(errorBody('PAYLOAD_TOO_LARGE', 'request body is too large'), 413),
    }),
    async (c) => {
      // 只接受 JSON 请求体：既符合契约，也避开跨站表单这类简单请求
      const contentType = c.req.header('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        return c.json(
          errorBody('UNSUPPORTED_MEDIA_TYPE', 'content-type must be application/json'),
          415,
        )
      }

      let body: unknown

      try {
        body = await c.req.json()
      } catch {
        return c.json(errorBody('INVALID_BODY', 'request body must be valid JSON'), 400)
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return c.json(errorBody('INVALID_BODY', 'request body must be a JSON object'), 400)
      }

      const raw = body as Record<string, unknown>
      const content = typeof raw.content === 'string' ? raw.content.trim() : ''

      if (!content) return c.json(errorBody('EMPTY_CONTENT', 'content is required'), 400)
      if (content.length > MAX_CONTENT_LENGTH) {
        return c.json(errorBody('CONTENT_TOO_LONG', 'content exceeds max length'), 400)
      }

      const post = store.add(toDraft(raw, content))
      c.header('Location', `/api/posts/${post.id}`)

      return c.json({ post }, 201)
    },
  )

  /**
   * 互动接口：active 是目标状态而不是取反，
   * 因此重复 PUT / DELETE 都幂等，网络重试不会把计数刷乱。
   */
  const reactionHandler = (apply: (id: string) => Post | undefined) => (c: Context) => {
    const id = c.req.param('id')
    const post = id ? apply(id) : undefined
    if (!post) return c.json(errorBody('NOT_FOUND', 'post not found'), 404)

    return c.json({ post })
  }

  app.put('/api/posts/:id/like', reactionHandler((id) => store.setLike(id, true)))
  app.delete('/api/posts/:id/like', reactionHandler((id) => store.setLike(id, false)))
  app.put('/api/posts/:id/favorite', reactionHandler((id) => store.setFavorite(id, true)))
  app.delete('/api/posts/:id/favorite', reactionHandler((id) => store.setFavorite(id, false)))

  // 路径存在但方法不支持时回 405，而不是混进 404
  app.all('/api/posts', (c) => {
    c.header('Allow', 'GET, POST')
    return c.json(errorBody('METHOD_NOT_ALLOWED', 'method not allowed'), 405)
  })

  const subResourceNotAllowed = (allow: string) => (c: Context) => {
    c.header('Allow', allow)
    return c.json(errorBody('METHOD_NOT_ALLOWED', 'method not allowed'), 405)
  }

  app.all('/api/posts/:id/like', subResourceNotAllowed('PUT, DELETE'))
  app.all('/api/posts/:id/favorite', subResourceNotAllowed('PUT, DELETE'))

  app.all('/api/posts/:id', (c) => {
    c.header('Allow', 'GET')
    return c.json(errorBody('METHOD_NOT_ALLOWED', 'method not allowed'), 405)
  })

  app.notFound((c) => c.json(errorBody('NOT_FOUND', 'resource not found'), 404))

  app.onError((error, c) => {
    console.error('[api] unhandled error:', error)
    return c.json(errorBody('INTERNAL_ERROR', 'internal server error'), 500)
  })

  return app
}
