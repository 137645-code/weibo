// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { MAX_CONTENT_LENGTH } from '../../src/constants/feed'
import type { Post } from '../../src/types/post'
import { createApp } from '../app'
import { createPostStore } from '../store'

const BASE_TIME = 1763000000000

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    content: '历史动态',
    createdAt: BASE_TIME,
    author: '林一',
    avatar: 2,
    location: '上海',
    ...overrides,
  }
}

/** 每次用例都拿一个干净的 app，避免内存数据串味 */
function setup(seed: Post[] = []) {
  const store = createPostStore()
  if (seed.length > 0) store.seed(seed)
  const app = createApp({ store })

  const request = (path: string, init?: RequestInit) => app.request(path, init)

  const create = (body: unknown) =>
    request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })

  return { app, store, request, create }
}

describe('GET /api/health', () => {
  it('返回服务与存储状态', async () => {
    const { request } = setup([makePost()])
    const res = await request('/api/health')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ status: 'ok', storage: 'memory', posts: 1 })
  })
})

describe('GET /api/posts', () => {
  it('空存储返回空数组', async () => {
    const { request } = setup()
    const res = await request('/api/posts')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ posts: [], total: 0 })
  })

  it('按发布时间倒序返回全部动态', async () => {
    const { request } = setup([
      makePost({ id: 'old', createdAt: 1, content: '最早' }),
      makePost({ id: 'new', createdAt: 3, content: '最新' }),
      makePost({ id: 'mid', createdAt: 2, content: '居中' }),
    ])
    const body = (await (await request('/api/posts')).json()) as {
      posts: Post[]
      total: number
    }

    expect(body.total).toBe(3)
    expect(body.posts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })
})

describe('POST /api/posts', () => {
  it('合法请求返回 201 与新建资源，并给出 Location 头', async () => {
    const { create, request } = setup()
    const res = await create({ content: '  新动态  ', author: ' 林一 ', avatar: 3, location: '上海' })

    expect(res.status).toBe(201)
    expect(res.headers.get('location')).toMatch(/^\/api\/posts\/.+$/)

    const { post } = (await res.json()) as { post: Post }
    expect(post).toMatchObject({ content: '新动态', author: '林一', avatar: 3, location: '上海' })
    expect(typeof post.id).toBe('string')
    expect(typeof post.createdAt).toBe('number')

    const detail = await request(`/api/posts/${post.id}`)
    expect(detail.status).toBe(200)
    expect(((await detail.json()) as { post: Post }).post).toEqual(post)
  })

  it('缺省字段补默认值', async () => {
    const { create } = setup()
    const res = await create({ content: '匿名动态' })
    const { post } = (await res.json()) as { post: Post }

    expect(post.author).toBe('匿名用户')
    expect(post.avatar).toBe(0)
    expect(post.location).toBeNull()
  })

  it('正文为空时返回 400 EMPTY_CONTENT', async () => {
    const { create } = setup()
    const res = await create({ content: '   ' })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'EMPTY_CONTENT', message: 'content is required' },
    })
  })

  it('缺少 content 字段时返回 400 EMPTY_CONTENT', async () => {
    const { create } = setup()
    const res = await create({ author: '林一' })

    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('EMPTY_CONTENT')
  })

  it('正文超长时返回 400 CONTENT_TOO_LONG', async () => {
    const { create } = setup()
    const res = await create({ content: 'a'.repeat(MAX_CONTENT_LENGTH + 1) })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'CONTENT_TOO_LONG', message: 'content exceeds max length' },
    })
  })

  it('正文恰好到上限时允许发布', async () => {
    const { create } = setup()
    const res = await create({ content: 'a'.repeat(MAX_CONTENT_LENGTH) })

    expect(res.status).toBe(201)
  })

  it('请求体非法 JSON 时返回 400 INVALID_BODY', async () => {
    const { create } = setup()
    const res = await create('{broken')

    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_BODY')
  })

  it('请求体为数组等非对象时返回 400 INVALID_BODY', async () => {
    const { create } = setup()
    const res = await create([{ content: '数组' }])

    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_BODY')
  })

  it('写入后列表可见且总数递增', async () => {
    const { create, request } = setup([makePost({ id: 'old', createdAt: 1 })])
    await create({ content: '第二条' })

    const body = (await (await request('/api/posts')).json()) as { posts: Post[]; total: number }

    expect(body.total).toBe(2)
    expect(body.posts[0].content).toBe('第二条')
  })
})

describe('GET /api/posts/:id', () => {
  it('id 不存在时返回 404 NOT_FOUND', async () => {
    const { request } = setup()
    const res = await request('/api/posts/missing')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'post not found' },
    })
  })
})

describe('协议细节', () => {
  it('content 非字符串时按空正文处理', async () => {
    const { create } = setup()
    const res = await create({ content: 123 })

    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('EMPTY_CONTENT')
  })

  it('JSON null 字面量返回 INVALID_BODY', async () => {
    const { create } = setup()
    const res = await create('null')

    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_BODY')
  })

  it('非 JSON 的 Content-Type 返回 415', async () => {
    const { request } = setup()
    const res = await request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'content=hi',
    })

    expect(res.status).toBe(415)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'UNSUPPORTED_MEDIA_TYPE',
    )
  })

  it('请求体超过上限时返回 413', async () => {
    const { create } = setup()
    const res = await create({ content: 'a'.repeat(64 * 1024), author: '林一' })

    expect(res.status).toBe(413)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'PAYLOAD_TOO_LARGE',
    )
  })

  it('方法不被支持时返回 405 并给出 Allow 头', async () => {
    const { request } = setup()

    const onCollection = await request('/api/posts', { method: 'PUT' })
    expect(onCollection.status).toBe(405)
    expect(onCollection.headers.get('allow')).toBe('GET, POST')

    const onItem = await request('/api/posts/p1', { method: 'DELETE' })
    expect(onItem.status).toBe(405)
    expect(onItem.headers.get('allow')).toBe('GET')
  })

  it('存储层异常时返回 500 INTERNAL_ERROR', async () => {
    const store = createPostStore()
    const failing = {
      ...store,
      add: () => {
        throw new Error('boom')
      },
    }
    const app = createApp({ store: failing })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '会炸' }),
    })
    spy.mockRestore()

    expect(res.status).toBe(500)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR')
  })
})

describe('兜底行为', () => {
  it('未知 /api 路径返回 404 JSON', async () => {
    const { request } = setup()
    const res = await request('/api/unknown')

    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND')
  })

  it('不同 app 实例互不共享内存数据', async () => {
    const first = setup()
    const second = setup()

    await first.create({ content: '第一条' })

    const body = (await (await second.request('/api/posts')).json()) as { total: number }
    expect(body.total).toBe(0)
  })
})
