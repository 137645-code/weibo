import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'
import { API_NOTICE_TEXT, EMPTY_CONTENT_HINT, EMPTY_FEED_TEXT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import { seedPosts, storedPosts } from '@/test/fakeServer'
import type { Post } from '@/types/post'

const STORED_POST: Post = {
  id: 'p1',
  content: '历史动态',
  createdAt: new Date(2026, 0, 5, 9, 7).getTime(),
  author: '林一',
  avatar: 2,
  location: '上海',
  likes: 0,
  liked: false,
  favorited: false,
}

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore(pinia)
  const wrapper = mount(App, { global: { plugins: [pinia] } })

  return { wrapper, store }
}

function stubGeolocationSuccess(latitude: number, longitude: number): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback) => {
        success({ coords: { latitude, longitude } } as GeolocationPosition)
      },
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

describe('App - 首屏', () => {
  it('渲染品牌区与空状态', async () => {
    const { wrapper } = mountApp()
    await flushPromises()

    expect(wrapper.find('.page-title').text()).toBe('Spark')
    expect(wrapper.find('.empty').text()).toBe(EMPTY_FEED_TEXT)
  })

  it('首屏加载中不展示空状态', () => {
    const { wrapper } = mountApp()

    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('从服务端读取并渲染数据', async () => {
    seedPosts([STORED_POST])

    const { wrapper } = mountApp()
    await flushPromises()

    expect(wrapper.findAll('.feed-item')).toHaveLength(1)
    expect(wrapper.find('.feed-content').text()).toBe('历史动态')
    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('服务端不可用时展示降级提示，页面仍可用', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))

    const { wrapper } = mountApp()
    await flushPromises()

    expect(wrapper.find('.notice').text()).toBe(API_NOTICE_TEXT)
    expect(wrapper.find('.empty').exists()).toBe(true)
  })
})

describe('App - 发布流程', () => {
  it('发布后立即出现在信息流最前并写入服务端', async () => {
    seedPosts([{ ...STORED_POST, id: 'old', createdAt: 1 }])

    const { wrapper } = mountApp()
    await flushPromises()

    await wrapper.find('textarea').setValue('刚刚的想法')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const contents = wrapper.findAll('.feed-content').map((node) => node.text())
    expect(contents).toEqual(['刚刚的想法', '历史动态'])

    const stored = storedPosts()
    expect(stored).toHaveLength(2)
    expect(stored[0]).toMatchObject({ content: '刚刚的想法' })
  })

  it('空内容提交时提示且不新增', async () => {
    const { wrapper } = mountApp()
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.hint-text').text()).toBe(EMPTY_CONTENT_HINT)
    expect(wrapper.findAll('.feed-item')).toHaveLength(0)
    expect(storedPosts()).toHaveLength(0)
  })
})

describe('App - 定位', () => {
  it('无法定位时展示不可用，且新动态不带地点', async () => {
    const { wrapper } = mountApp()
    await flushPromises()

    expect(wrapper.find('.loc-status').text()).toBe('位置不可用')

    await wrapper.find('textarea').setValue('无地点动态')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.feed-loc').exists()).toBe(false)
  })

  it('定位成功后展示城市，新动态带上地点', async () => {
    stubGeolocationSuccess(39.9042, 116.4074)

    const { wrapper } = mountApp()
    await flushPromises()

    expect(wrapper.find('.loc-status').text()).toBe('已定位：北京')

    await wrapper.find('textarea').setValue('北京动态')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.feed-loc').text()).toBe('北京')
  })
})
