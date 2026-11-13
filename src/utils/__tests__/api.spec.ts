import { describe, expect, it, vi } from 'vitest'
import type { Post } from '@/types/post'
import { createPostApi } from '../api'

const BASE_TIME = 1763000000000

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    content: '历史动态',
    createdAt: BASE_TIME,
    author: '林一',
    avatar: 2,
    location: '上海',
    likes: 0,
    liked: false,
    favorited: false,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createFetchStub(response: Response | (() => Promise<Response>)) {
  return vi.fn<typeof fetch>(async () =>
    typeof response === 'function' ? response() : response,
  )
}

describe('createPostApi - 读取', () => {
  it('解析服务端返回的动态列表', async () => {
    const post = makePost()
    const fetchImpl = createFetchStub(jsonResponse({ posts: [post], total: 1 }))
    const api = createPostApi({ fetchImpl })

    await expect(api.load()).resolves.toEqual({ list: [post], ok: true })
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/posts')
  })

  it('过滤缺字段的脏数据，保留合法项', async () => {
    const post = makePost()
    const fetchImpl = createFetchStub(
      jsonResponse({
        posts: [post, null, { id: 'x' }, { ...post, id: 'p2', createdAt: 'bad' }],
        total: 4,
      }),
    )
    const api = createPostApi({ fetchImpl })

    const result = await api.load()

    expect(result.ok).toBe(true)
    expect(result.list.map((item) => item.id)).toEqual(['p1'])
  })

  it('响应结构不符时降级为空列表且标记失败', async () => {
    const api = createPostApi({ fetchImpl: createFetchStub(jsonResponse({ posts: 'oops' })) })

    await expect(api.load()).resolves.toEqual({ list: [], ok: false })
  })

  it('服务端 5xx 时标记失败', async () => {
    const api = createPostApi({
      fetchImpl: createFetchStub(jsonResponse({ error: { code: 'INTERNAL_ERROR' } }, 500)),
    })

    await expect(api.load()).resolves.toEqual({ list: [], ok: false })
  })

  it('网络异常时标记失败且不抛出', async () => {
    const api = createPostApi({
      fetchImpl: createFetchStub(() => Promise.reject(new Error('offline'))),
    })

    await expect(api.load()).resolves.toEqual({ list: [], ok: false })
  })

  it('支持自定义 baseUrl', async () => {
    const fetchImpl = createFetchStub(jsonResponse({ posts: [], total: 0 }))
    const api = createPostApi({ baseUrl: '/v2', fetchImpl })

    await api.load()

    expect(fetchImpl.mock.calls[0][0]).toBe('/v2/posts')
  })
})

describe('createPostApi - 发布', () => {
  it('以 POST JSON 提交草稿并返回新建动态', async () => {
    const post = makePost({ id: 'new', content: '新动态' })
    const fetchImpl = createFetchStub(jsonResponse({ post }, 201))
    const api = createPostApi({ fetchImpl })

    const result = await api.create({ content: '新动态', author: '林一', avatar: 3 })

    expect(result).toEqual({ ok: true, post })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/posts')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Content-Type')).toContain('application/json')
    expect(JSON.parse(String(init?.body))).toEqual({ content: '新动态', author: '林一', avatar: 3 })
  })

  it('空正文被服务端拒绝时返回 empty', async () => {
    const fetchImpl = createFetchStub(
      jsonResponse({ error: { code: 'EMPTY_CONTENT', message: 'content is required' } }, 400),
    )
    const api = createPostApi({ fetchImpl })

    await expect(api.create({ content: '  ' })).resolves.toEqual({ ok: false, reason: 'empty' })
  })

  it('正文超长被服务端拒绝时返回 too-long', async () => {
    const fetchImpl = createFetchStub(
      jsonResponse({ error: { code: 'CONTENT_TOO_LONG', message: 'too long' } }, 400),
    )
    const api = createPostApi({ fetchImpl })

    await expect(api.create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'too-long',
    })
  })

  it('服务端 5xx 时返回 unavailable', async () => {
    const api = createPostApi({
      fetchImpl: createFetchStub(jsonResponse({ error: { code: 'INTERNAL_ERROR' } }, 500)),
    })

    await expect(api.create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('网络异常时返回 unavailable 且不抛出', async () => {
    const api = createPostApi({
      fetchImpl: createFetchStub(() => Promise.reject(new Error('offline'))),
    })

    await expect(api.create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('请求体过大被服务端拒绝时返回 too-long', async () => {
    const fetchImpl = createFetchStub(
      jsonResponse({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'too large' } }, 413),
    )

    await expect(createPostApi({ fetchImpl }).create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'too-long',
    })
  })

  it('4xx 但错误码未知时返回 unavailable', async () => {
    const fetchImpl = createFetchStub(
      jsonResponse({ error: { code: 'SOMETHING_ELSE', message: 'nope' } }, 422),
    )

    await expect(createPostApi({ fetchImpl }).create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('400 但响应体不是 JSON 时也不抛出', async () => {
    const fetchImpl = createFetchStub(
      new Response('<html>bad gateway</html>', {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    await expect(createPostApi({ fetchImpl }).create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('2xx 但响应缺少 post 时归为 unavailable', async () => {
    const fetchImpl = createFetchStub(jsonResponse({ ok: true }, 201))

    await expect(createPostApi({ fetchImpl }).create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })
})

describe('createPostApi - 超时与路径', () => {
  it('请求超时后降级，不会永久挂起', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    const api = createPostApi({ fetchImpl, timeoutMs: 5 })

    await expect(api.load()).resolves.toEqual({ list: [], ok: false })
    await expect(api.create({ content: 'x' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('baseUrl 末尾带斜杠时不会拼出双斜杠', async () => {
    const fetchImpl = createFetchStub(jsonResponse({ posts: [], total: 0 }))

    await createPostApi({ baseUrl: '/api/', fetchImpl }).load()

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/posts')
  })
})

describe('createPostApi - 互动字段解析', () => {
  it('旧数据缺少互动字段时回落为未点赞、未收藏', async () => {
    const legacy = {
      id: 'old',
      content: '旧动态',
      createdAt: BASE_TIME,
      author: '林一',
      avatar: 2,
      location: null,
    }
    const fetchImpl = createFetchStub(jsonResponse({ posts: [legacy], total: 1 }))

    const result = await createPostApi({ fetchImpl }).load()

    expect(result.list[0]).toMatchObject({ likes: 0, liked: false, favorited: false })
  })

  it('脏计数与字符串标记被收敛，不会污染界面', async () => {
    const dirty = makePost({ likes: -3, liked: 'true' as unknown as boolean })
    const fetchImpl = createFetchStub(
      jsonResponse({ posts: [{ ...dirty, likes: 7.8 }], total: 1 }),
    )

    const result = await createPostApi({ fetchImpl }).load()

    expect(result.list[0]).toMatchObject({ likes: 7, liked: false })
  })
})

describe('createPostApi - 点赞与收藏', () => {
  it('点赞使用 PUT，取消点赞使用 DELETE', async () => {
    const post = makePost({ likes: 1, liked: true })
    // 同一个 Response 只能读一次，两次请求各取一个新响应
    const fetchImpl = createFetchStub(() => Promise.resolve(jsonResponse({ post })))
    const api = createPostApi({ fetchImpl })

    await expect(api.setReaction('p1', 'like', true)).resolves.toEqual({ ok: true, post })
    await expect(api.setReaction('p1', 'like', false)).resolves.toEqual({ ok: true, post })

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/posts/p1/like')
    expect(fetchImpl.mock.calls[0][1]?.method).toBe('PUT')
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/posts/p1/like')
    expect(fetchImpl.mock.calls[1][1]?.method).toBe('DELETE')
  })

  it('收藏走 /favorite 路径', async () => {
    const post = makePost({ favorited: true })
    const fetchImpl = createFetchStub(jsonResponse({ post }))

    await createPostApi({ fetchImpl }).setReaction('p1', 'favorite', true)

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/posts/p1/favorite')
    expect(fetchImpl.mock.calls[0][1]?.method).toBe('PUT')
  })

  it('id 中的特殊字符会被转义', async () => {
    const fetchImpl = createFetchStub(jsonResponse({ post: makePost() }))

    await createPostApi({ fetchImpl }).setReaction('a/b c', 'like', true)

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/posts/a%2Fb%20c/like')
  })

  it('404 映射为 not-found，其余失败一律 unavailable', async () => {
    const notFound = createPostApi({
      fetchImpl: createFetchStub(
        jsonResponse({ error: { code: 'NOT_FOUND', message: 'post not found' } }, 404),
      ),
    })
    await expect(notFound.setReaction('x', 'like', true)).resolves.toEqual({
      ok: false,
      reason: 'not-found',
    })

    const broken = createPostApi({
      fetchImpl: createFetchStub(jsonResponse({ error: { code: 'INTERNAL_ERROR' } }, 500)),
    })
    await expect(broken.setReaction('x', 'like', true)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('网络异常与响应缺字段都不抛出', async () => {
    const offline = createPostApi({
      fetchImpl: createFetchStub(() => Promise.reject(new Error('offline'))),
    })
    await expect(offline.setReaction('x', 'favorite', true)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })

    const empty = createPostApi({ fetchImpl: createFetchStub(jsonResponse({}, 200)) })
    await expect(empty.setReaction('x', 'like', true)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })
})
