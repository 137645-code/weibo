import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTHOR } from '@/constants/feed'
import { normalizeAuthor, normalizeAvatar, normalizeLocation } from '../normalize'

describe('normalizeAuthor', () => {
  it('去除首尾空白', () => {
    expect(normalizeAuthor('  林一  ')).toBe('林一')
  })

  it('空串回落为默认昵称', () => {
    expect(normalizeAuthor('')).toBe(DEFAULT_AUTHOR)
  })

  it('纯空白回落为默认昵称', () => {
    expect(normalizeAuthor('    ')).toBe(DEFAULT_AUTHOR)
  })

  it('超过 20 字时截断', () => {
    expect(normalizeAuthor('一'.repeat(25))).toHaveLength(20)
  })

  it('非字符串一律回落为默认昵称', () => {
    expect(normalizeAuthor(null)).toBe(DEFAULT_AUTHOR)
    expect(normalizeAuthor(undefined)).toBe(DEFAULT_AUTHOR)
    expect(normalizeAuthor(123)).toBe(DEFAULT_AUTHOR)
  })
})

describe('normalizeAvatar', () => {
  it('合法数字原样返回', () => {
    expect(normalizeAvatar(0)).toBe(0)
    expect(normalizeAvatar(3)).toBe(3)
    expect(normalizeAvatar(9)).toBe(9)
  })

  it('数字字符串解析为数字', () => {
    expect(normalizeAvatar('5')).toBe(5)
    expect(normalizeAvatar('3.9')).toBe(3)
  })

  it('小数向下取整', () => {
    expect(normalizeAvatar(3.9)).toBe(3)
  })

  it('越界与非法值回落为 0', () => {
    expect(normalizeAvatar(-1)).toBe(0)
    expect(normalizeAvatar(10)).toBe(0)
    expect(normalizeAvatar(99)).toBe(0)
    expect(normalizeAvatar('abc')).toBe(0)
    expect(normalizeAvatar(null)).toBe(0)
    expect(normalizeAvatar(undefined)).toBe(0)
    expect(normalizeAvatar(Number.NaN)).toBe(0)
  })
})

describe('normalizeLocation', () => {
  it('去除首尾空白', () => {
    expect(normalizeLocation(' 上海 ')).toBe('上海')
  })

  it('空值与纯空白统一为 null', () => {
    expect(normalizeLocation('')).toBeNull()
    expect(normalizeLocation('   ')).toBeNull()
  })

  it('非字符串统一为 null', () => {
    expect(normalizeLocation(null)).toBeNull()
    expect(normalizeLocation(undefined)).toBeNull()
    expect(normalizeLocation(42)).toBeNull()
  })

  it('超过 20 字时截断', () => {
    expect(normalizeLocation('城'.repeat(30))).toHaveLength(20)
  })
})
