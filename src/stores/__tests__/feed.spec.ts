import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
