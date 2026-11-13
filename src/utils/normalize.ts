import {
  AVATAR_COUNT,
  DEFAULT_AUTHOR,
  MAX_AUTHOR_LENGTH,
  MAX_LOCATION_LENGTH,
} from '../constants/feed'

/**
 * 昵称归一化：去首尾空白、截断 20 字，空值回落到默认昵称。
 */
export function normalizeAuthor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_AUTHOR

  const text = value.trim().slice(0, MAX_AUTHOR_LENGTH)
  return text || DEFAULT_AUTHOR
}

/**
 * 头像索引归一化：非法值、越界值统一回落到第 0 张。
 */
export function normalizeAvatar(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= AVATAR_COUNT) return 0
  return Math.floor(parsed)
}

/**
 * 地点归一化：空串与非法值统一为 null，渲染时即不显示。
 */
export function normalizeLocation(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const text = value.trim()
  return text ? text.slice(0, MAX_LOCATION_LENGTH) : null
}

/**
 * 计数值归一化：负数、非整数、非数字一律回落为 0，避免脏数据渲染出 NaN。
 */
export function normalizeCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

/**
 * 布尔标记归一化：只认真正的 true，其余（含 "true" 字符串）统一为 false。
 */
export function normalizeFlag(value: unknown): boolean {
  return value === true
}
