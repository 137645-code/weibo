import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Post } from '@/types/post'
import PostItem from '../PostItem.vue'

const POST: Post = {
  id: 'p1',
  content: '今天的第一条动态',
  createdAt: new Date(2026, 0, 5, 9, 7).getTime(),
  author: '林一',
  avatar: 2,
  location: '上海',
}

function mountItem(post: Post = POST) {
  return mount(PostItem, { props: { post } })
}

describe('PostItem', () => {
  it('展示昵称、格式化的时间与正文', () => {
    const wrapper = mountItem()

    expect(wrapper.find('.feed-author').text()).toBe('林一')
    expect(wrapper.find('.feed-time').text()).toBe('2026-01-05 09:07')
    expect(wrapper.find('.feed-content').text()).toBe('今天的第一条动态')
  })

  it('有地点时展示地点', () => {
    expect(mountItem().find('.feed-loc').text()).toBe('上海')
  })

  it('无地点时不渲染地点节点', () => {
    const wrapper = mountItem({ ...POST, location: null })
    expect(wrapper.find('.feed-loc').exists()).toBe(false)
  })

  it('头像按索引拼接路径并带尺寸属性', () => {
    const img = mountItem().find('.feed-avatar img')

    expect(img.attributes('src')).toBe('avatars/avatar-03.jpg')
    expect(img.attributes('width')).toBe('44')
    expect(img.attributes('alt')).toBe('')
  })

  it('头像加载失败时隐藏图片，由容器渐变兜底', async () => {
    const wrapper = mountItem()
    await wrapper.find('.feed-avatar img').trigger('error')

    expect(wrapper.find('.feed-avatar img').attributes('style')).toContain('hidden')
  })

  it('正文保留用户输入的换行文本', () => {
    const wrapper = mountItem({ ...POST, content: '第一行\n第二行' })
    expect(wrapper.find('.feed-content').element.textContent).toBe('第一行\n第二行')
  })
})
