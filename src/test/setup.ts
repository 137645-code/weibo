import { afterEach, beforeEach, vi } from 'vitest'
import { resetTestServer, testFetch } from './fakeServer'

// 每个用例前重置内存后端并接管 fetch，用例之间不共享数据；不再依赖任何浏览器存储
beforeEach(() => {
  resetTestServer()
  vi.stubGlobal('fetch', testFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})
