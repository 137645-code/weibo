import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  FAVORITE_LABEL,
  FAVORITED_TEXT,
  FAVORITE_TEXT,
  LIKE_LABEL,
  UNFAVORITE_LABEL,
  UNLIKE_LABEL,
} from '@/constants/feed'
import type { Post } from '@/types/post'
import PostItem from '../PostItem.vue'

const POST: Post = {
  id: 'p1',
  content: '今天的第一条动态',
  createdAt: new Date(2026, 0, 5, 9, 7).getTime(),
  author: '林一',
  avatar: 2,
  location: '上海',
  likes: 0,
  liked: false,
  favorited: false,
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

describe('PostItem - 互动操作栏', () => {
  it('默认展示未点赞、未收藏状态与点赞计数', () => {
    const wrapper = mountItem()
    const like = wrapper.find('.feed-action-like')
    const favorite = wrapper.find('.feed-action-favorite')

    expect(like.attributes('aria-pressed')).toBe('false')
    expect(like.attributes('aria-label')).toBe(LIKE_LABEL)
    expect(wrapper.find('.feed-action-count').text()).toBe('0')
    expect(favorite.attributes('aria-pressed')).toBe('false')
    expect(favorite.attributes('aria-label')).toBe(FAVORITE_LABEL)
    expect(wrapper.find('.feed-action-text').text()).toBe(FAVORITE_TEXT)
  })

  it('已点赞时进入激活态，名称变为取消点赞并展示计数', () => {
    const wrapper = mountItem({ ...POST, liked: true, likes: 12 })
    const like = wrapper.find('.feed-action-like')

    expect(like.classes()).toContain('is-active')
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.attributes('aria-label')).toBe(UNLIKE_LABEL)
    expect(wrapper.find('.feed-action-count').text()).toBe('12')
  })

  it('已收藏时按钮文案与可访问名称同步切换', () => {
    const wrapper = mountItem({ ...POST, favorited: true })
    const favorite = wrapper.find('.feed-action-favorite')

    expect(favorite.classes()).toContain('is-active')
    expect(favorite.attributes('aria-pressed')).toBe('true')
    expect(favorite.attributes('aria-label')).toBe(UNFAVORITE_LABEL)
    expect(wrapper.find('.feed-action-text').text()).toBe(FAVORITED_TEXT)
  })

  it('点击分别派发点赞与收藏事件', async () => {
    const wrapper = mountItem()

    await wrapper.find('.feed-action-like').trigger('click')
    await wrapper.find('.feed-action-favorite').trigger('click')

    expect(wrapper.emitted('toggle-like')).toHaveLength(1)
    expect(wrapper.emitted('toggle-favorite')).toHaveLength(1)
  })

  it('请求在途时只禁用对应按钮，不改变激活状态', () => {
    const wrapper = mount(PostItem, {
      props: { post: { ...POST, liked: true }, pendingLike: true },
    })

    const like = wrapper.find('.feed-action-like')
    expect(like.attributes('disabled')).toBeDefined()
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.feed-action-favorite').attributes('disabled')).toBeUndefined()
  })

  it('点赞与收藏状态互不影响', () => {
    const wrapper = mountItem({ ...POST, liked: true, likes: 1, favorited: false })

    expect(wrapper.find('.feed-action-like').classes()).toContain('is-active')
    expect(wrapper.find('.feed-action-favorite').classes()).not.toContain('is-active')
  })
})
