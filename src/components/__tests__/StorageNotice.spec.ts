import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { STORAGE_NOTICE_TEXT } from '@/constants/feed'
import { useFeedStore } from '@/stores/feed'
import StorageNotice from '../StorageNotice.vue'

function mountNotice(storageOk: boolean) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore(pinia)
  store.storageOk = storageOk

  return mount(StorageNotice, { global: { plugins: [pinia] } })
}

describe('StorageNotice', () => {
  it('存储可用时不渲染', () => {
    const wrapper = mountNotice(true)

    expect(wrapper.find('.notice').exists()).toBe(false)
  })

  it('存储不可用时展示降级提示', () => {
    const wrapper = mountNotice(false)
    const notice = wrapper.find('.notice')

    expect(notice.exists()).toBe(true)
    expect(notice.text()).toBe(STORAGE_NOTICE_TEXT)
    expect(notice.attributes('role')).toBe('status')
  })
})
