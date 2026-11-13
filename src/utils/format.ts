import { normalizeAvatar } from './normalize'

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/**
 * 时间戳格式化为 YYYY-MM-DD HH:mm。非法时间返回空串。
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return `${day} ${time}`
}

/**
 * 头像图片路径：索引越界时回落到第 1 张，路径只在这里拼接。
 */
export function avatarSrc(index: unknown): string {
  const fileIndex = normalizeAvatar(index) + 1
  const name = fileIndex < 10 ? `0${fileIndex}` : String(fileIndex)
  return `avatars/avatar-${name}.jpg`
}
