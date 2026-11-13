// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createServerApp } from '../serverApp'
import { createPostStore } from '../store'

let distDir: string | undefined

function makeDist(): string {
  distDir = mkdtempSync(join(tmpdir(), 'spark-dist-'))
  writeFileSync(
    join(distDir, 'index.html'),
    '<!doctype html><html><body><div id="app">spark shell</div></body></html>',
  )
  return distDir
}

afterAll(() => {
  if (distDir) rmSync(distDir, { recursive: true, force: true })
})

describe('createServerApp - 静态资源与 API 的边界', () => {
  it('未知 /api 路径仍是 JSON 404，不会被 SPA 兜底吞成 200 HTML', async () => {
    const app = createServerApp({ store: createPostStore(), distDir: makeDist() })
    const res = await app.request('/api/unknown')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND')
  })

  it('不存在的动态仍是 404，不返回首页', async () => {
    const app = createServerApp({ store: createPostStore(), distDir: makeDist() })
    const res = await app.request('/api/posts/missing')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('根路径与前端路由回落到构建产物', async () => {
    const app = createServerApp({ store: createPostStore(), distDir: makeDist() })

    for (const path of ['/', '/feed/2026']) {
      const res = await app.request(path)

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('spark shell')
    }
  })

  it('没有构建产物时只提供 API', async () => {
    const app = createServerApp({ store: createPostStore(), distDir: undefined })
    const res = await app.request('/')

    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND')
  })
})
