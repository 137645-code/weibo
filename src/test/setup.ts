import { afterEach, beforeEach } from 'vitest'

// 每个用例前后清空浏览器存储，保证用例之间互不污染
beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})
