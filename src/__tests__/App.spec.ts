import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App.vue'
import {
  EMPTY_CONTENT_HINT,
  EMPTY_FEED_TEXT,
  STORAGE_KEY,
  STORAGE_NOTICE_TEXT,
} from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import type { Post } from '@/types/post'

const STORED_POST: Post = {
  id: 'p1',
  content: '历史动态',
  createdAt: new Date(2026, 0, 5, 9, 7).getTime(),
  author: '林一',
  avatar: 2,
  location: '上海',
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
  it('渲染品牌区与空状态', () => {
    const { wrapper } = mountApp()

    expect(wrapper.find('.page-title').text()).toBe('Spark')
    expect(wrapper.find('.empty').text()).toBe(EMPTY_FEED_TEXT)
  })

  it('读取并渲染已存的数据', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([STORED_POST]))

    const { wrapper } = mountApp()

    expect(wrapper.findAll('.feed-item')).toHaveLength(1)
    expect(wrapper.find('.feed-content').text()).toBe('历史动态')
    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('存储损坏时展示降级提示，页面仍可用', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken')

    const { wrapper } = mountApp()

    expect(wrapper.find('.notice').text()).toBe(STORAGE_NOTICE_TEXT)
    expect(wrapper.find('.empty').exists()).toBe(true)
  })
})

describe('App - 发布流程', () => {
  it('发布后立即出现在信息流最前并持久化', async () => {
    const older: Post = { ...STORED_POST, id: 'old', createdAt: 1 }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([older]))

    const { wrapper } = mountApp()

    await wrapper.find('textarea').setValue('刚刚的想法')
    await wrapper.find('form').trigger('submit')

    const contents = wrapper.findAll('.feed-content').map((node) => node.text())
    expect(contents).toEqual(['刚刚的想法', '历史动态'])

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as Post[]
    expect(stored).toHaveLength(2)
    expect(stored[1]).toMatchObject({ content: '刚刚的想法' })
  })

  it('空内容提交时提示且不新增', async () => {
    const { wrapper } = mountApp()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('.hint-text').text()).toBe(EMPTY_CONTENT_HINT)
    expect(wrapper.findAll('.feed-item')).toHaveLength(0)
  })
})

describe('App - 定位', () => {
  it('无法定位时展示不可用，且新动态不带地点', async () => {
    const { wrapper } = mountApp()
    await flushPromises()

    expect(wrapper.find('.loc-status').text()).toBe('位置不可用')

    await wrapper.find('textarea').setValue('无地点动态')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('.feed-loc').exists()).toBe(false)
  })

  it('定位成功后展示城市，新动态带上地点', async () => {
    stubGeolocationSuccess(39.9042, 116.4074)

    const { wrapper } = mountApp()
    await flushPromises()

    expect(wrapper.find('.loc-status').text()).toBe('已定位：北京')

    await wrapper.find('textarea').setValue('北京动态')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('.feed-loc').text()).toBe('北京')
  })
})
