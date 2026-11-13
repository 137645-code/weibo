import { createApp } from '../../server/app'
import { createPostStore } from '../../server/store'
import type { Post } from '../types/post'

/**
 * 测试用的「真实后端」：直接复用 Hono 应用与内存存储，
 * 通过 fetch 适配器接管全局 fetch，让前端代码走完整的 HTTP 契约，
 * 而不用手写 fetch mock。
 */
export const testStore = createPostStore()
export const testApp = createApp({ store: testStore })

/** 每个用例前清空内存数据，保证用例之间互不污染 */
export function resetTestServer(): void {
  testStore.reset()
}

/** 预置历史数据，模拟「服务端已有内容」 */
export function seedPosts(posts: Post[]): void {
  testStore.reset()
  testStore.seed(posts)
}

/** 以当前服务端数据快照断言「已写入」 */
export function storedPosts(): Post[] {
  return testStore.list()
}

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) return input
  return new Request(new URL(String(input), 'http://localhost'), init)
}

/** 把 app.fetch 包装成浏览器 fetch 的签名 */
export const testFetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
  testApp.fetch(toRequest(input, init))) as typeof fetch
