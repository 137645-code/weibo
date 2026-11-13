import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '@/constants/feed'
import type { Post } from '@/types/post'
import { createPostStorage } from '../storage'

/** 内存版 Storage，用于避免依赖 jsdom 实现细节，也便于制造异常 */
function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial))

  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, String(value))
    },
  }
}

const VALID_POST: Post = {
  id: 'p1',
  content: '今天的第一条动态',
  createdAt: 1763000000000,
  author: '林一',
  avatar: 2,
  location: '上海',
}

describe('createPostStorage - load', () => {
  it('存储为空时返回空列表且可用', () => {
    const storage = createPostStorage(createMemoryStorage())
    expect(storage.load()).toEqual({ list: [], ok: true })
  })

  it('读取并还原合法数据', () => {
    const raw = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify([VALID_POST]) })
    expect(createPostStorage(raw).load()).toEqual({ list: [VALID_POST], ok: true })
  })

  it('JSON 损坏时降级为空列表且标记存储不可用', () => {
    const raw = createMemoryStorage({ [STORAGE_KEY]: '{broken' })
    expect(createPostStorage(raw).load()).toEqual({ list: [], ok: false })
  })

  it('顶层不是数组时返回空列表但标记可用', () => {
    const raw = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ list: [] }) })
    expect(createPostStorage(raw).load()).toEqual({ list: [], ok: true })
  })

  it('过滤损坏条目', () => {
    const dirty = [
      null,
      'string',
      {},
      { content: '   ', createdAt: 1 },
      { content: 123, createdAt: 1 },
      { content: '没有时间戳' },
      { content: '时间戳非法', createdAt: '1' },
      { content: '时间戳为 NaN', createdAt: Number.NaN },
      VALID_POST,
    ]
    const raw = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(dirty) })
    const result = createPostStorage(raw).load()

    expect(result.ok).toBe(true)
    expect(result.list).toHaveLength(1)
    expect(result.list[0]).toEqual(VALID_POST)
  })

  it('旧数据缺少 id 时用时间戳与下标兜底', () => {
    const raw = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify([{ content: '旧动态', createdAt: 1763000000123 }]),
    })
    const [post] = createPostStorage(raw).load().list

    expect(post.id).toBe('1763000000123_0')
  })

  it('旧数据缺少昵称/头像/地点时补默认值', () => {
    const raw = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify([
        { id: 'x', content: '旧动态', createdAt: 1763000000123 },
      ]),
    })
    const [post] = createPostStorage(raw).load().list

    expect(post).toEqual({
      id: 'x',
      content: '旧动态',
      createdAt: 1763000000123,
      author: '匿名用户',
      avatar: 0,
      location: null,
    })
  })

  it('读取时对已存在字段做归一化', () => {
    const raw = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify([
        { id: 'x', content: '动态', createdAt: 1, author: '   ', avatar: 88, location: '   ' },
      ]),
    })
    const [post] = createPostStorage(raw).load().list

    expect(post.author).toBe('匿名用户')
    expect(post.avatar).toBe(0)
    expect(post.location).toBeNull()
  })

  it('读取异常时降级为空列表且标记不可用', () => {
    const storage = createMemoryStorage()
    storage.getItem = () => {
      throw new Error('storage disabled')
    }

    expect(createPostStorage(storage).load()).toEqual({ list: [], ok: false })
  })

  it('没有可用存储时视为不可用', () => {
    expect(createPostStorage(null).load()).toEqual({ list: [], ok: false })
  })
})

describe('createPostStorage - save', () => {
  it('写入成功返回 true 且可被再次读取', () => {
    const raw = createMemoryStorage()
    const storage = createPostStorage(raw)

    expect(storage.save([VALID_POST])).toBe(true)
    expect(raw.getItem(STORAGE_KEY)).toBe(JSON.stringify([VALID_POST]))
    expect(storage.load().list).toEqual([VALID_POST])
  })

  it('写入异常时返回 false 而不抛出', () => {
    const raw = createMemoryStorage()
    raw.setItem = () => {
      throw new Error('quota exceeded')
    }

    expect(() => createPostStorage(raw).save([VALID_POST])).not.toThrow()
    expect(createPostStorage(raw).save([VALID_POST])).toBe(false)
  })

  it('没有可用存储时写入返回 false', () => {
    expect(createPostStorage(null).save([VALID_POST])).toBe(false)
  })

  it('未注入时默认使用 window.localStorage', () => {
    const storage = createPostStorage()

    expect(storage.save([VALID_POST])).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([VALID_POST]))
    expect(storage.load().list).toEqual([VALID_POST])
  })
})
