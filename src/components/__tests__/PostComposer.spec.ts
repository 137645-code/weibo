import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AVATAR_COUNT,
  DEFAULT_HINT,
  EMPTY_CONTENT_HINT,
  HINT_RESET_DELAY,
  MAX_AUTHOR_LENGTH,
  MAX_CONTENT_LENGTH,
  PUBLISH_FAILED_HINT,
} from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import { flushMicrotasks } from '@/test/flush'
import PostComposer from '../PostComposer.vue'

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore(pinia)

  const mountComposer = () =>
    mount(PostComposer, {
      global: { plugins: [pinia] },
      attachTo: document.body,
    })

  return { store, mountComposer }
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('PostComposer - 表单结构', () => {
  it('渲染 10 个头像单选项并默认选中第一个', () => {
    const { mountComposer } = setup()
    const wrapper = mountComposer()
    const radios = wrapper.findAll('input[type="radio"]')

    expect(radios).toHaveLength(AVATAR_COUNT)
    expect((radios[0].element as HTMLInputElement).checked).toBe(true)
  })

  it('正文与昵称带长度限制', () => {
    const { mountComposer } = setup()
    const wrapper = mountComposer()

    expect(wrapper.find('textarea').attributes('maxlength')).toBe(String(MAX_CONTENT_LENGTH))
    expect(wrapper.find('input[type="text"]').attributes('maxlength')).toBe(
      String(MAX_AUTHOR_LENGTH),
    )
  })

  it('默认展示字数提示', () => {
    const { mountComposer } = setup()
    const wrapper = mountComposer()

    expect(wrapper.find('.hint-text').text()).toBe(DEFAULT_HINT)
  })
})

describe('PostComposer - 发布', () => {
  it('发布成功后新增动态，并清空正文、保留昵称与头像', async () => {
    const { store, mountComposer } = setup()
    const wrapper = mountComposer()

    await wrapper.find('input[type="text"]').setValue('林一')
    await wrapper.findAll('input[type="radio"]')[2].setValue(true)
    await wrapper.find('textarea').setValue('  今天的第一条动态  ')
    await wrapper.find('form').trigger('submit')
    await flushMicrotasks()

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0]).toMatchObject({
      content: '今天的第一条动态',
      author: '林一',
      avatar: 2,
    })
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('林一')
    expect(
      (wrapper.findAll('input[type="radio"]')[2].element as HTMLInputElement).checked,
    ).toBe(true)
  })

  it('发布后焦点回到正文输入框', async () => {
    const { mountComposer } = setup()
    const wrapper = mountComposer()

    await wrapper.find('textarea').setValue('你好')
    await wrapper.find('form').trigger('submit')
    await flushMicrotasks()

    expect(document.activeElement).toBe(wrapper.find('textarea').element)
  })

  it('提交过程中禁用发布按钮，避免重复提交', async () => {
    const { mountComposer } = setup()
    const wrapper = mountComposer()
    const button = wrapper.find('.btn-submit')

    await wrapper.find('textarea').setValue('你好')
    expect(button.attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    expect(button.attributes('disabled')).toBeDefined()

    await flushMicrotasks()
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('内容为空时提示并拒绝发布，2 秒后提示恢复默认', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { store, mountComposer } = setup()
    const wrapper = mountComposer()

    await wrapper.find('form').trigger('submit')
    await flushMicrotasks()

    const hint = wrapper.find('.hint-text')
    expect(hint.text()).toBe(EMPTY_CONTENT_HINT)
    expect(hint.attributes('data-state')).toBe('warn')
    expect(store.posts).toHaveLength(0)

    vi.advanceTimersByTime(HINT_RESET_DELAY)
    await nextTick()

    expect(wrapper.find('.hint-text').text()).toBe(DEFAULT_HINT)
    expect(wrapper.find('.hint-text').attributes('data-state')).toBe('normal')
  })

  it('服务端不可用时提示失败并保留正文', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))

    const { store, mountComposer } = setup()
    const wrapper = mountComposer()

    await wrapper.find('textarea').setValue('发不出去的想法')
    await wrapper.find('form').trigger('submit')
    await flushMicrotasks()

    expect(wrapper.find('.hint-text').text()).toBe(PUBLISH_FAILED_HINT)
    expect(wrapper.find('.hint-text').attributes('data-state')).toBe('warn')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('发不出去的想法')
    expect(store.posts).toHaveLength(0)
  })
})

describe('PostComposer - 定位状态', () => {
  it('未开始定位时不展示定位文案', () => {
    const { mountComposer } = setup()
    const wrapper = mountComposer()

    expect(wrapper.find('.loc-status').exists()).toBe(false)
  })

  it('定位中展示提示', () => {
    const { store, mountComposer } = setup()
    store.setLocationStatus('locating')
    const wrapper = mountComposer()

    expect(wrapper.find('.loc-status').text()).toBe('定位中…')
  })

  it('定位成功展示城市名', () => {
    const { store, mountComposer } = setup()
    store.setLocation('上海')
    store.setLocationStatus('ready')
    const wrapper = mountComposer()

    expect(wrapper.find('.loc-status').text()).toBe('已定位：上海')
    expect(wrapper.find('.loc-status').attributes('data-state')).toBe('normal')
  })

  it('定位失败展示不可用并标记为警示', () => {
    const { store, mountComposer } = setup()
    store.setLocationStatus('unavailable')
    const wrapper = mountComposer()

    expect(wrapper.find('.loc-status').text()).toBe('位置不可用')
    expect(wrapper.find('.loc-status').attributes('data-state')).toBe('warn')
  })
})
