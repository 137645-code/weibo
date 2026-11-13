import { describe, expect, it } from 'vitest'
import { avatarSrc, formatTime } from '../format'

describe('formatTime', () => {
  it('输出 YYYY-MM-DD HH:mm 并补零', () => {
    const ts = new Date(2026, 0, 5, 9, 7).getTime()
    expect(formatTime(ts)).toBe('2026-01-05 09:07')
  })

  it('两位数字不做额外处理', () => {
    const ts = new Date(2026, 10, 23, 18, 45).getTime()
    expect(formatTime(ts)).toBe('2026-11-23 18:45')
  })

  it('非法时间戳返回空串', () => {
    expect(formatTime(Number.NaN)).toBe('')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('avatarSrc', () => {
  it('索引从 0 开始，文件名从 01 开始', () => {
    expect(avatarSrc(0)).toBe('avatars/avatar-01.jpg')
    expect(avatarSrc(9)).toBe('avatars/avatar-10.jpg')
  })

  it('非法索引回落到第一张', () => {
    expect(avatarSrc(-3)).toBe('avatars/avatar-01.jpg')
    expect(avatarSrc(10)).toBe('avatars/avatar-01.jpg')
  })
})
