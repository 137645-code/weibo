import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { EMPTY_FAVORITE_TEXT, EMPTY_FEED_TEXT } from '@/constants/feed'
import type { Post } from '@/types/post'
import { seedPosts, storedPosts, testFetch } from '@/test/fakeServer'
import { useFeedStore } from '../feed'

const BASE_TIME = 1763000000000

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    content: '今天的第一条动态',
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

function stubFetchFailure(): void {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
}

describe('useFeedStore - 初始化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态：空信息流、服务可用、未完成首屏加载', () => {
    const store = useFeedStore()

    expect(store.posts).toEqual([])
    expect(store.apiOk).toBe(true)
    expect(store.initialized).toBe(false)
    expect(store.isEmpty).toBe(true)
    expect(store.location).toBeNull()
    expect(store.locationStatus).toBe('idle')
  })

  it('init 从服务端读取动态', async () => {
    const stored = makePost()
    seedPosts([stored])

    const store = useFeedStore()
    await store.init()

    expect(store.posts).toEqual([stored])
    expect(store.apiOk).toBe(true)
    expect(store.initialized).toBe(true)
  })

  it('服务端无数据时 init 得到空列表', async () => {
    const store = useFeedStore()
    await store.init()

    expect(store.posts).toEqual([])
    expect(store.apiOk).toBe(true)
    expect(store.initialized).toBe(true)
  })

  it('服务端不可用时 init 标记降级且不影响后续操作', async () => {
    stubFetchFailure()

    const store = useFeedStore()
    await store.init()

    expect(store.posts).toEqual([])
    expect(store.apiOk).toBe(false)
    expect(store.initialized).toBe(true)
  })

  it('重新 init 可拿到服务端的最新数据', async () => {
    seedPosts([makePost()])

    setActivePinia(createPinia())
    const first = useFeedStore()
    await first.init()
    await first.addPost({ content: '第二条' })

    setActivePinia(createPinia())
    const second = useFeedStore()
    await second.init()

    expect(second.posts).toHaveLength(2)
    expect(second.posts.map((post) => post.content)).toContain('第二条')
  })

  it('首屏加载与发布交错时，不会用旧快照覆盖刚发布的动态', async () => {
    seedPosts([makePost({ id: 'server', createdAt: 1, content: '服务端旧数据' })])

    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    // GET 立刻拿到快照，但延迟交付，模拟慢接口先发后至
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await testFetch(input, init)
      if (!init?.method || init.method === 'GET') await gate
      return response
    })

    const store = useFeedStore()
    const loading = store.init()
    const created = store.addPost({ content: '加载期间发布' })
    release?.()

    await created
    await loading

    const contents = store.posts.map((post) => post.content)
    expect(contents).toContain('加载期间发布')
    expect(contents).toContain('服务端旧数据')
  })

  it('服务恢复后 apiOk 复位', async () => {
    const store = useFeedStore()
    await store.init()

    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    const failed = await store.addPost({ content: '失败一次' })
    expect(failed).toEqual({ ok: false, reason: 'unavailable' })
    expect(store.apiOk).toBe(false)

    vi.stubGlobal('fetch', testFetch)
    const recovered = await store.addPost({ content: '恢复了' })
    expect(recovered.ok).toBe(true)
    expect(store.apiOk).toBe(true)
  })
})

describe('useFeedStore - 派生数据', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('按发布时间倒序排列', () => {
    const store = useFeedStore()
    store.posts = [
      makePost({ id: 'old', createdAt: 1, content: '最早' }),
      makePost({ id: 'new', createdAt: 3, content: '最新' }),
      makePost({ id: 'mid', createdAt: 2, content: '居中' }),
    ]

    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('排序不修改原始顺序', () => {
    const store = useFeedStore()
    store.posts = [
      makePost({ id: 'old', createdAt: 1 }),
      makePost({ id: 'new', createdAt: 2 }),
    ]

    expect(store.posts.map((post) => post.id)).toEqual(['old', 'new'])
    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'old'])
  })

  it('isEmpty 随数据变化', async () => {
    const store = useFeedStore()
    await store.init()

    expect(store.isEmpty).toBe(true)

    await store.addPost({ content: '第一条' })
    expect(store.isEmpty).toBe(false)
  })
})

describe('useFeedStore - 发布', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('发布成功后写入服务端并返回动态', async () => {
    const store = useFeedStore()
    await store.init()

    const result = await store.addPost({ content: '  新动态  ', author: ' 林一 ', avatar: 3 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.content).toBe('新动态')
    expect(result.post.author).toBe('林一')
    expect(result.post.avatar).toBe(3)
    expect(store.posts).toHaveLength(1)
    expect(storedPosts()).toHaveLength(1)
    expect(storedPosts()[0]).toMatchObject({ content: '新动态', author: '林一', avatar: 3 })
  })

  it('正文为空时拒绝发布且不写入服务端', async () => {
    const store = useFeedStore()
    await store.init()

    const result = await store.addPost({ content: '   ' })

    expect(result).toEqual({ ok: false, reason: 'empty' })
    expect(store.posts).toHaveLength(0)
    expect(storedPosts()).toHaveLength(0)
  })

  it('正文超长时拒绝发布并返回 too-long', async () => {
    const store = useFeedStore()
    await store.init()

    const result = await store.addPost({ content: 'a'.repeat(501) })

    expect(result).toEqual({ ok: false, reason: 'too-long' })
    expect(store.posts).toHaveLength(0)
  })

  it('缺省昵称与越界头像使用默认值', async () => {
    const store = useFeedStore()
    await store.init()

    const result = await store.addPost({ content: '匿名动态', avatar: 99 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.author).toBe('匿名用户')
    expect(result.post.avatar).toBe(0)
  })

  it('未定位时地点为 null', async () => {
    const store = useFeedStore()
    await store.init()

    const result = await store.addPost({ content: '无地点' })

    expect(result.ok && result.post.location).toBeNull()
  })

  it('已定位时新动态带上地点', async () => {
    const store = useFeedStore()
    await store.init()
    store.setLocation('上海')

    const result = await store.addPost({ content: '带地点' })

    expect(result.ok && result.post.location).toBe('上海')
    expect(storedPosts()[0].location).toBe('上海')
  })

  it('服务端不可用时返回 unavailable 并标记降级，不污染本地列表', async () => {
    const store = useFeedStore()
    await store.init()
    stubFetchFailure()

    const result = await store.addPost({ content: '发不出去' })

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(store.apiOk).toBe(false)
    expect(store.posts).toHaveLength(0)
  })

  it('提交过程中 submitting 为 true，结束后复位', async () => {
    const store = useFeedStore()
    await store.init()

    const pending = store.addPost({ content: '进行中' })
    expect(store.submitting).toBe(true)

    await pending
    expect(store.submitting).toBe(false)
  })

  it('新发布的动态排在信息流最前', async () => {
    seedPosts([makePost({ createdAt: 1 })])
    const store = useFeedStore()
    await store.init()

    await store.addPost({ content: '更新的动态' })

    expect(store.sortedPosts[0].content).toBe('更新的动态')
  })
})

describe('useFeedStore - 定位状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('更新定位状态与城市', () => {
    const store = useFeedStore()

    store.setLocationStatus('locating')
    expect(store.locationStatus).toBe('locating')

    store.setLocation('北京')
    store.setLocationStatus('ready')
    expect(store.location).toBe('北京')
    expect(store.locationStatus).toBe('ready')

    store.setLocation(null)
    store.setLocationStatus('unavailable')
    expect(store.location).toBeNull()
    expect(store.locationStatus).toBe('unavailable')
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * 互动请求替身：GET 仍走真实 Hono 应用，
 * PUT / DELETE 由用例决定返回，前端分支互不依赖后端实现细节。
 */
function stubReaction(respond: (init?: RequestInit) => Response): Mock<typeof fetch> {
  const stub = vi.fn<typeof fetch>(async (input, init) => {
    if (!init?.method || init.method === 'GET') return testFetch(input, init)
    return respond(init)
  })
  vi.stubGlobal('fetch', stub)

  return stub
}

describe('useFeedStore - 点赞与收藏', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('点赞先乐观更新，成功后用服务端计数对齐', async () => {
    let release: ((response: Response) => void) | undefined
    const stub = vi.fn<typeof fetch>((input, init) => {
      if (!init?.method || init.method === 'GET') return testFetch(input, init)
      return new Promise<Response>((resolve) => {
        release = resolve
      })
    })
    vi.stubGlobal('fetch', stub)

    const store = useFeedStore()
    store.posts = [makePost({ likes: 2 })]

    const pending = store.toggleReaction('p1', 'like')

    // 请求还没回来，界面已经先变
    expect(store.posts[0]).toMatchObject({ liked: true, likes: 3 })
    expect(store.isReactionPending('p1', 'like')).toBe(true)

    // 在途期间再点一次：不发第二个请求，也不把计数点到 4
    const again = await store.toggleReaction('p1', 'like')
    expect(again.ok).toBe(true)
    expect(stub.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
    expect(store.posts[0].likes).toBe(3)

    release?.(jsonResponse({ post: makePost({ liked: true, likes: 9 }) }))
    await pending

    expect(store.posts[0]).toMatchObject({ liked: true, likes: 9 })
    expect(store.isReactionPending('p1', 'like')).toBe(false)
  })

  it('取消点赞用 DELETE 并把计数减一', async () => {
    const stub = stubReaction(() => jsonResponse({ post: makePost({ liked: false, likes: 0 }) }))
    const store = useFeedStore()
    store.posts = [makePost({ liked: true, likes: 1 })]

    await store.toggleReaction('p1', 'like')

    expect(stub.mock.calls[0][0]).toBe('/api/posts/p1/like')
    expect(stub.mock.calls[0][1]?.method).toBe('DELETE')
    expect(store.posts[0]).toMatchObject({ liked: false, likes: 0 })
  })

  it('请求失败时回滚并标记服务降级', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    const store = useFeedStore()
    store.posts = [makePost({ likes: 2 })]

    const result = await store.toggleReaction('p1', 'like')

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(store.posts[0]).toMatchObject({ liked: false, likes: 2 })
    expect(store.reactionFailed).toBe(true)
    expect(store.apiOk).toBe(false)
    expect(store.isReactionPending('p1', 'like')).toBe(false)
  })

  it('目标动态已不存在时返回 not-found，不影响服务可用标记', async () => {
    stubReaction(() => jsonResponse({ error: { code: 'NOT_FOUND', message: 'gone' } }, 404))
    const store = useFeedStore()
    store.posts = [makePost()]

    const result = await store.toggleReaction('p1', 'like')

    expect(result).toEqual({ ok: false, reason: 'not-found' })
    expect(store.posts[0].liked).toBe(false)
    expect(store.apiOk).toBe(true)
  })

  it('本地没有该动态时直接返回 not-found，不发请求', async () => {
    const stub = stubReaction(() => jsonResponse({ post: makePost() }))
    const store = useFeedStore()

    await expect(store.toggleReaction('missing', 'like')).resolves.toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(stub).not.toHaveBeenCalled()
  })

  it('收藏只切换 favorited，不影响点赞状态', async () => {
    stubReaction(() => jsonResponse({ post: makePost({ favorited: true, liked: true, likes: 3 }) }))
    const store = useFeedStore()
    store.posts = [makePost({ liked: true, likes: 3 })]

    await store.toggleReaction('p1', 'favorite')

    expect(store.posts[0]).toMatchObject({ favorited: true, liked: true, likes: 3 })
  })

  it('成功时只回填本次改动的字段，不覆盖另一类互动', async () => {
    // 服务端返回的整条数据里 favorited 为 true，但这个用例只点赞
    stubReaction(() => jsonResponse({ post: makePost({ favorited: true, liked: true, likes: 1 }) }))
    const store = useFeedStore()
    store.posts = [makePost({ favorited: false })]

    await store.toggleReaction('p1', 'like')

    expect(store.posts[0]).toMatchObject({ liked: true, likes: 1, favorited: false })
  })

  it('首屏刷新不会用服务端旧快照覆盖在途的点赞状态', async () => {
    seedPosts([makePost({ likes: 2 })])

    let release: ((response: Response) => void) | undefined
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') return testFetch(input, init)
      return new Promise<Response>((resolve) => {
        release = resolve
      })
    })

    const store = useFeedStore()
    await store.init()

    const pending = store.toggleReaction('p1', 'like')
    await store.init()

    expect(store.posts[0]).toMatchObject({ liked: true, likes: 3 })

    release?.(jsonResponse({ post: makePost({ liked: true, likes: 3 }) }))
    await pending
  })
})

describe('useFeedStore - 收藏筛选', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认展示全部动态', () => {
    const store = useFeedStore()
    store.posts = [makePost({ id: 'a' }), makePost({ id: 'b', favorited: true })]

    expect(store.filter).toBe('all')
    expect(store.visiblePosts).toHaveLength(2)
    expect(store.emptyText).toBe(EMPTY_FEED_TEXT)
  })

  it('只看收藏时仅保留已收藏的动态', () => {
    const store = useFeedStore()
    store.posts = [
      makePost({ id: 'a', createdAt: 2 }),
      makePost({ id: 'b', createdAt: 1, favorited: true }),
    ]

    store.setFilter('favorites')

    expect(store.visiblePosts.map((post) => post.id)).toEqual(['b'])
    expect(store.isEmpty).toBe(false)
  })

  it('收藏为空时展示收藏专属空态', () => {
    const store = useFeedStore()
    store.posts = [makePost()]

    store.setFilter('favorites')

    expect(store.isEmpty).toBe(true)
    expect(store.emptyText).toBe(EMPTY_FAVORITE_TEXT)
  })

  it('收藏后不必切换筛选也能看到收藏结果', async () => {
    stubReaction(() => jsonResponse({ post: makePost({ favorited: true }) }))
    const store = useFeedStore()
    store.posts = [makePost()]

    await store.toggleReaction('p1', 'favorite')
    store.setFilter('favorites')

    expect(store.visiblePosts).toHaveLength(1)
  })
})
