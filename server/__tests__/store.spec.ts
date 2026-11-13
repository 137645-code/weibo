// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../../src/types/post'
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
    likes: 0,
    liked: false,
    favorited: false,
    ...overrides,
  }
}

describe('createPostStore - 读取', () => {
  it('初始为空列表', () => {
    const store = createPostStore()

    expect(store.list()).toEqual([])
  })

  it('按发布时间倒序返回，且不破坏内部顺序', () => {
    const store = createPostStore()
    store.seed([
      makePost({ id: 'old', createdAt: 1 }),
      makePost({ id: 'new', createdAt: 3 }),
      makePost({ id: 'mid', createdAt: 2 }),
    ])

    expect(store.list().map((post) => post.id)).toEqual(['new', 'mid', 'old'])
    expect(store.list().map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('find 命中已存在的动态', () => {
    const store = createPostStore()
    store.seed([makePost({ id: 'abc' })])

    expect(store.find('abc')?.id).toBe('abc')
    expect(store.find('missing')).toBeUndefined()
  })

  it('list 返回副本，外部修改不影响存储', () => {
    const store = createPostStore()
    store.seed([makePost()])

    store.list().pop()

    expect(store.list()).toHaveLength(1)
  })

  it('修改返回对象的字段不会回流到存储', () => {
    const store = createPostStore()
    store.seed([makePost({ content: '原始内容' })])

    const fromList = store.list()[0]
    fromList.content = '被改掉了'
    const fromFind = store.find('p1')
    if (fromFind) fromFind.content = '也被改掉了'

    expect(store.list()[0].content).toBe('原始内容')
    expect(store.find('p1')?.content).toBe('原始内容')
  })
})

describe('createPostStore - 写入', () => {
  it('add 用注入的时钟与随机源构造动态', () => {
    const store = createPostStore({ now: () => 1700000000000, random: () => 0.5 })
    const post = store.add({ content: '  今天的第一条动态  ' })

    expect(post.createdAt).toBe(1700000000000)
    expect(post.content).toBe('今天的第一条动态')
    expect(store.list()).toHaveLength(1)
  })

  it('add 归一化昵称、头像与地点', () => {
    const store = createPostStore()

    const anonymous = store.add({ content: '匿名', avatar: 99 })
    expect(anonymous.author).toBe('匿名用户')
    expect(anonymous.avatar).toBe(0)
    expect(anonymous.location).toBeNull()

    const named = store.add({ content: '具名', author: ' 林一 ', avatar: 3, location: ' 上海 ' })
    expect(named.author).toBe('林一')
    expect(named.avatar).toBe(3)
    expect(named.location).toBe('上海')
  })

  it('add 不覆盖已有数据，后写入的排在最前', () => {
    const store = createPostStore({ now: () => 1 })
    store.seed([makePost({ id: 'old', createdAt: 1 })])
    store.add({ content: '更新的动态', author: '林一' })

    const list = store.list()

    expect(list).toHaveLength(2)
    expect(list[0].content).toBe('更新的动态')
  })

  it('reset 清空全部数据', () => {
    const store = createPostStore()
    store.seed([makePost()])

    store.reset()

    expect(store.list()).toEqual([])
    expect(store.find('p1')).toBeUndefined()
  })

  it('同一毫秒、相同随机源下 id 仍然唯一', () => {
    const store = createPostStore({ now: () => 1, random: () => 0.5 })
    const first = store.add({ content: '第一条' })
    const second = store.add({ content: '第二条' })

    expect(first.id).not.toBe(second.id)
    expect(store.count()).toBe(2)
  })

  it('count 反映当前条数', () => {
    const store = createPostStore()
    expect(store.count()).toBe(0)

    store.add({ content: '第一条' })
    expect(store.count()).toBe(1)
  })
})
