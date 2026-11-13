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

describe('createPostStore - 点赞与收藏', () => {
  it('点赞后计数加一并标记已点赞', () => {
    const store = createPostStore()
    store.seed([makePost({ likes: 2 })])

    const updated = store.setLike('p1', true)

    expect(updated).toMatchObject({ liked: true, likes: 3 })
    expect(store.find('p1')).toMatchObject({ liked: true, likes: 3 })
  })

  it('重复点赞幂等，计数不会重复增加', () => {
    const store = createPostStore()
    store.seed([makePost({ likes: 2 })])

    store.setLike('p1', true)
    store.setLike('p1', true)

    expect(store.find('p1')?.likes).toBe(3)
  })

  it('取消点赞计数减一，重复取消不会变成负数', () => {
    const store = createPostStore()
    store.seed([makePost({ liked: true, likes: 1 })])

    expect(store.setLike('p1', false)).toMatchObject({ liked: false, likes: 0 })
    expect(store.setLike('p1', false)).toMatchObject({ liked: false, likes: 0 })
  })

  it('点赞为 true 但计数为 0 的脏数据取消时不会变负', () => {
    const store = createPostStore()
    store.seed([makePost({ liked: true, likes: 0 })])

    expect(store.setLike('p1', false)?.likes).toBe(0)
  })

  it('取消点赞后重新点赞，计数回到原值', () => {
    const store = createPostStore()
    store.seed([makePost({ likes: 7, liked: true })])

    store.setLike('p1', false)
    expect(store.find('p1')).toMatchObject({ liked: false, likes: 6 })

    store.setLike('p1', true)
    expect(store.find('p1')).toMatchObject({ liked: true, likes: 7 })
  })

  it('收藏只切换状态，不影响点赞', () => {
    const store = createPostStore()
    store.seed([makePost({ likes: 5, liked: true })])

    const favorited = store.setFavorite('p1', true)
    expect(favorited).toMatchObject({ favorited: true, liked: true, likes: 5 })

    const canceled = store.setFavorite('p1', false)
    expect(canceled).toMatchObject({ favorited: false, liked: true, likes: 5 })
  })

  it('重复收藏与重复取消都是幂等的', () => {
    const store = createPostStore()
    store.seed([makePost()])

    store.setFavorite('p1', true)
    expect(store.setFavorite('p1', true)).toMatchObject({ favorited: true })

    store.setFavorite('p1', false)
    expect(store.setFavorite('p1', false)).toMatchObject({ favorited: false })
  })

  it('id 不存在时返回 undefined 且不写入数据', () => {
    const store = createPostStore()
    store.seed([makePost({ id: 'p1' })])

    expect(store.setLike('missing', true)).toBeUndefined()
    expect(store.setFavorite('missing', true)).toBeUndefined()
    expect(store.count()).toBe(1)
  })

  it('返回的是副本，外部修改不会回流到存储', () => {
    const store = createPostStore()
    store.seed([makePost()])

    const updated = store.setLike('p1', true)
    if (updated) updated.likes = 999

    expect(store.find('p1')?.likes).toBe(1)
  })

  it('互动变更不改变倒序顺序', () => {
    const store = createPostStore()
    store.seed([
      makePost({ id: 'old', createdAt: 1 }),
      makePost({ id: 'new', createdAt: 3 }),
      makePost({ id: 'mid', createdAt: 2 }),
    ])

    store.setLike('old', true)
    store.setFavorite('mid', true)

    expect(store.list().map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('seed 归一化缺失与脏的互动字段', () => {
    const store = createPostStore()
    const dirty = {
      ...makePost(),
      likes: -5,
      liked: 'true',
      favorited: 1,
    } as unknown as Post

    store.seed([dirty, makePost({ id: 'p2', liked: true, likes: 0 })])

    expect(store.find('p1')).toMatchObject({ likes: 0, liked: false, favorited: false })
    // 已点赞但计数为 0 时至少显示 1，避免「红心 + 0」的矛盾展示
    expect(store.find('p2')).toMatchObject({ liked: true, likes: 1 })
  })
})
