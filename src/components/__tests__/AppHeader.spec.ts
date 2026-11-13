import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppHeader from '../AppHeader.vue'

describe('AppHeader', () => {
  it('展示品牌名、中文名与副标题', () => {
    const wrapper = mount(AppHeader)

    expect(wrapper.find('.page-title').text()).toBe('Spark')
    expect(wrapper.find('.page-name-cn').text()).toBe('星火')
    expect(wrapper.find('.page-subtitle').text()).toBe('把此刻的想法留在这里，内容仅保存在本机浏览器')
  })

  it('包含内联 SVG 星形图标且不引用外部资源', () => {
    const wrapper = mount(AppHeader)
    const svg = wrapper.find('.brand-icon svg')

    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 64 64')
    expect(wrapper.findAll('.brand-icon image')).toHaveLength(0)
  })
})
