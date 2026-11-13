import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { API_NOTICE_TEXT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import ServerNotice from '../ServerNotice.vue'

function mountNotice(apiOk: boolean) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore(pinia)
  store.apiOk = apiOk

  return mount(ServerNotice, { global: { plugins: [pinia] } })
}

describe('ServerNotice', () => {
  it('服务可用时不渲染', () => {
    const wrapper = mountNotice(true)

    expect(wrapper.find('.notice').exists()).toBe(false)
  })

  it('服务不可用时展示降级提示', () => {
    const wrapper = mountNotice(false)
    const notice = wrapper.find('.notice')

    expect(notice.exists()).toBe(true)
    expect(notice.text()).toBe(API_NOTICE_TEXT)
    expect(notice.attributes('role')).toBe('status')
  })
})
