import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTHOR } from '@/constants/feed'
import { createPost } from '../post'

const NOW = 1763000000000

function deps(random = () => 0.5) {
  return { now: () => NOW, random }
}

describe('createPost', () => {
  it('构造完整动态并归一化字段', () => {
    const post = createPost(
      { content: '  今天的第一条动态  ', author: ' 林一 ', avatar: 3, location: ' 上海 ' },
      deps(),
    )

    expect(post).not.toBeNull()
    expect(post).toMatchObject({
      content: '今天的第一条动态',
      createdAt: NOW,
      author: '林一',
      avatar: 3,
      location: '上海',
    })
  })

  it('正文为空时返回 null', () => {
    expect(createPost({ content: '   ' }, deps())).toBeNull()
    expect(createPost({ content: '' }, deps())).toBeNull()
  })

  it('缺省昵称、越界头像、缺省地点使用默认值', () => {
    const post = createPost({ content: '你好', avatar: 42 }, deps())

    expect(post?.author).toBe(DEFAULT_AUTHOR)
    expect(post?.avatar).toBe(0)
    expect(post?.location).toBeNull()
  })

  it('id 由时间戳 36 进制与随机串拼接', () => {
    const post = createPost({ content: '你好' }, deps())

    // (0.5).toString(36) === '0.i'，截取小数部分后为 'i'
    expect(post?.id).toBe(`${NOW.toString(36)}_i`)
  })

  it('使用注入的时钟而非系统时间', () => {
    const post = createPost({ content: '你好' }, { now: () => 123, random: () => 0.5 })
    expect(post?.createdAt).toBe(123)
  })

  it('不修改传入的草稿对象', () => {
    const draft = { content: '  你好  ', author: ' 林一 ', avatar: 1 }
    createPost(draft, deps())

    expect(draft).toEqual({ content: '  你好  ', author: ' 林一 ', avatar: 1 })
  })

  it('相同时间下随机串不同则 id 不同', () => {
    const a = createPost({ content: '甲' }, deps(() => 0.1))
    const b = createPost({ content: '乙' }, deps(() => 0.9))

    expect(a?.id).not.toBe(b?.id)
  })
})
