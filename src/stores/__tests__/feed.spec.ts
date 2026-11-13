import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '@/constants/feed'
import type { Post } from '@/types/post'
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

function readStored(): Post[] {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as Post[]) : []
}

describe('useFeedStore - 初始化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态为空且可用', () => {
    const store = useFeedStore()

    expect(store.posts).toEqual([])
    expect(store.storageOk).toBe(true)
    expect(store.location).toBeNull()
    expect(store.locationStatus).toBe('idle')
  })

  it('init 读取已存数据', () => {
    const stored = makePost()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))

    const store = useFeedStore()
    store.init()

    expect(store.posts).toEqual([stored])
    expect(store.storageOk).toBe(true)
  })

  it('空存储时 init 得到空列表', () => {
    const store = useFeedStore()
    store.init()

    expect(store.posts).toEqual([])
    expect(store.storageOk).toBe(true)
  })

  it('数据损坏时 init 标记存储不可用', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken')

    const store = useFeedStore()
    store.init()

    expect(store.posts).toEqual([])
    expect(store.storageOk).toBe(false)
  })

  it('占用内存的数据在刷新后仍可恢复：新 store 再次 init 可读到同一份数据', () => {
    const stored = makePost()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]))

    setActivePinia(createPinia())
    const first = useFeedStore()
    first.init()
    const reloaded = first.addPost({ content: '第二条' })
    expect(reloaded.ok).toBe(true)

    setActivePinia(createPinia())
    const second = useFeedStore()
    second.init()

    expect(second.posts).toHaveLength(2)
    expect(second.posts.map((post) => post.content)).toContain('第二条')
  })
})

describe('useFeedStore - 派生数据', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('按发布时间倒序排列', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        makePost({ id: 'old', createdAt: 1, content: '最早' }),
        makePost({ id: 'new', createdAt: 3, content: '最新' }),
        makePost({ id: 'mid', createdAt: 2, content: '居中' }),
      ]),
    )

    const store = useFeedStore()
    store.init()

    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('排序不修改原始顺序', () => {
    const oldest = makePost({ id: 'old', createdAt: 1 })
    const newest = makePost({ id: 'new', createdAt: 2 })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([oldest, newest]))

    const store = useFeedStore()
    store.init()

    expect(store.posts.map((post) => post.id)).toEqual(['old', 'new'])
    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'old'])
  })

  it('isEmpty 随数据变化', () => {
    const store = useFeedStore()
    store.init()

    expect(store.isEmpty).toBe(true)

    store.addPost({ content: '第一条' })
    expect(store.isEmpty).toBe(false)
  })
})

describe('useFeedStore - 发布', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('发布成功后写入存储并返回动态', () => {
    const store = useFeedStore()
    store.init()

    const result = store.addPost({ content: '  新动态  ', author: ' 林一 ', avatar: 3 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.content).toBe('新动态')
    expect(result.post.author).toBe('林一')
    expect(result.post.avatar).toBe(3)
    expect(store.posts).toHaveLength(1)
    expect(readStored()).toHaveLength(1)
    expect(readStored()[0]).toMatchObject({ content: '新动态', author: '林一', avatar: 3 })
  })

  it('正文为空时拒绝发布且不写入存储', () => {
    const store = useFeedStore()
    store.init()

    const result = store.addPost({ content: '   ' })

    expect(result).toEqual({ ok: false, reason: 'empty' })
    expect(store.posts).toHaveLength(0)
    expect(readStored()).toHaveLength(0)
  })

  it('缺省昵称与越界头像使用默认值', () => {
    const store = useFeedStore()
    store.init()

    const result = store.addPost({ content: '匿名动态', avatar: 99 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.author).toBe('匿名用户')
    expect(result.post.avatar).toBe(0)
  })

  it('未定位时地点为 null', () => {
    const store = useFeedStore()
    store.init()

    const result = store.addPost({ content: '无地点' })

    expect(result.ok && result.post.location).toBeNull()
  })

  it('已定位时新动态带上地点', () => {
    const store = useFeedStore()
    store.init()
    store.setLocation('上海')

    const result = store.addPost({ content: '带地点' })

    expect(result.ok && result.post.location).toBe('上海')
    expect(readStored()[0].location).toBe('上海')
  })

  it('写入失败时保留内存数据并标记存储不可用', () => {
    const store = useFeedStore()
    store.init()
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded')
      })

    const result = store.addPost({ content: '写不进去' })

    expect(result.ok).toBe(true)
    expect(store.storageOk).toBe(false)
    expect(store.posts).toHaveLength(1)

    setItem.mockRestore()
  })

  it('新发布的动态排在信息流最前', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([makePost({ createdAt: 1 })]))
    const store = useFeedStore()
    store.init()

    store.addPost({ content: '更新的动态' })

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
