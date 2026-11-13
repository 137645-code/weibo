import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import {
  EMPTY_FAVORITE_TEXT,
  EMPTY_FEED_TEXT,
  FILTER_ALL_TEXT,
  FILTER_FAVORITE_TEXT,
  REACTION_FAILED_HINT,
} from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import { flushMicrotasks } from '@/test/flush'
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
    likes: 0,
    liked: false,
    favorited: false,
    ...overrides,
  }
}

function mountFeed(posts: Post[] = [], initialized = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore(pinia)
  store.posts = posts
  store.initialized = initialized

  const wrapper = mount(PostFeed, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

describe('PostFeed', () => {
  it('无内容时展示空状态', () => {
    const { wrapper } = mountFeed()

    expect(wrapper.find('.empty').text()).toBe(EMPTY_FEED_TEXT)
    expect(wrapper.findAll('.feed-item')).toHaveLength(0)
  })

  it('首屏加载中不展示空状态，避免闪一下「还没有内容」', () => {
    const { wrapper } = mountFeed([], false)

    expect(wrapper.find('.empty').exists()).toBe(false)
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

describe('PostFeed - 点赞与收藏', () => {
  it('有内容时展示全部 / 我的收藏筛选，默认选中全部', () => {
    const { wrapper } = mountFeed([makePost({})])
    const tabs = wrapper.findAll('.filter-tab')

    expect(tabs).toHaveLength(2)
    expect(tabs[0].text()).toBe(FILTER_ALL_TEXT)
    expect(tabs[1].text()).toBe(FILTER_FAVORITE_TEXT)
    expect(tabs[0].attributes('aria-pressed')).toBe('true')
    expect(tabs[1].attributes('aria-pressed')).toBe('false')
  })

  it('没有内容时不展示筛选器', () => {
    const { wrapper } = mountFeed()

    expect(wrapper.find('.feed-filters').exists()).toBe(false)
  })

  it('切换到我的收藏只渲染已收藏的动态', async () => {
    const { wrapper } = mountFeed([
      makePost({ id: 'a', content: '未收藏的动态', createdAt: 2 }),
      makePost({ id: 'b', content: '已收藏的动态', createdAt: 1, favorited: true }),
    ])

    await wrapper.findAll('.filter-tab')[1].trigger('click')

    expect(wrapper.findAll('.feed-content').map((node) => node.text())).toEqual(['已收藏的动态'])
    expect(wrapper.findAll('.filter-tab')[1].attributes('aria-pressed')).toBe('true')
  })

  it('没有收藏时展示收藏专属空态', async () => {
    const { wrapper } = mountFeed([makePost({})])

    await wrapper.findAll('.filter-tab')[1].trigger('click')

    expect(wrapper.find('.empty').text()).toBe(EMPTY_FAVORITE_TEXT)
  })

  it('点击点赞后计数更新并进入激活态', async () => {
    const post = makePost({ likes: 2 })
    const { wrapper } = mountFeed([post])
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({ post: { ...post, liked: true, likes: 3 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 500 })
    })

    await wrapper.find('.feed-action-like').trigger('click')
    await flushMicrotasks()

    expect(wrapper.find('.feed-action-count').text()).toBe('3')
    expect(wrapper.find('.feed-action-like').attributes('aria-pressed')).toBe('true')
  })

  it('互动失败时回滚计数并展示轻提示', async () => {
    const { wrapper } = mountFeed([makePost({ likes: 2 })])
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))

    await wrapper.find('.feed-action-like').trigger('click')
    await flushMicrotasks()

    expect(wrapper.find('.feed-action-count').text()).toBe('2')
    expect(wrapper.find('.feed-action-like').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('.feed-alert').text()).toBe(REACTION_FAILED_HINT)
  })
})
