import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { EMPTY_FEED_TEXT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import type { Post } from '@/types/post'
import PostFeed from '../PostFeed.vue'

function makePost(overrides: Partial<Post>): Post {
  return {
    id: 'p1',
    content: '动态',
    createdAt: 1,
    author: '匿名用户',
    avatar: 0,
    location: null,
    ...overrides,
  }
}

function mountFeed(posts: Post[] = []) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore(pinia)
  store.posts = posts

  const wrapper = mount(PostFeed, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

describe('PostFeed', () => {
  it('无内容时展示空状态', () => {
    const { wrapper } = mountFeed()

    expect(wrapper.find('.empty').text()).toBe(EMPTY_FEED_TEXT)
    expect(wrapper.findAll('.feed-item')).toHaveLength(0)
  })

  it('有内容时隐藏空状态', () => {
    const { wrapper } = mountFeed([makePost({})])

    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('按发布时间倒序渲染', () => {
    const { wrapper } = mountFeed([
      makePost({ id: 'old', content: '最早', createdAt: 1 }),
      makePost({ id: 'new', content: '最新', createdAt: 3 }),
      makePost({ id: 'mid', content: '居中', createdAt: 2 }),
    ])

    expect(wrapper.findAll('.feed-content').map((node) => node.text())).toEqual([
      '最新',
      '居中',
      '最早',
    ])
  })

  it('新增数据后列表响应式更新', async () => {
    const { wrapper, store } = mountFeed()
    store.posts = [makePost({ content: '新动态' })]
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.feed-item')).toHaveLength(1)
    expect(wrapper.find('.empty').exists()).toBe(false)
  })
})
