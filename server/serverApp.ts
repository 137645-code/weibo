import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Hono } from 'hono'
import { createApp } from './app'
import { type PostStore } from './store'

export interface ServerAppOptions {
  store: PostStore
  /** 前端构建产物目录；目录不存在时只提供 /api */
  distDir?: string
}

function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/')
}

/** serveStatic 的 root 相对进程工作目录，这里统一换算成可用的相对路径 */
function toStaticRoot(absoluteDir: string): string {
  const rel = relative(process.cwd(), absoluteDir).replace(/\\/g, '/')
  return rel === '' ? '.' : rel
}

/**
 * 生产装配：API + 前端静态资源。
 * 静态资源与 SPA 兜底只接管非 /api 路径，否则 /api 的 404 会被 index.html 吞成 200。
 */
export function createServerApp(options: ServerAppOptions): Hono {
  const app = createApp({ store: options.store })
  const { distDir } = options

  if (!distDir || !existsSync(distDir)) return app

  const root = toStaticRoot(distDir)

  app.use('/*', (c, next) => {
    if (isApiPath(c.req.path)) return next()
    return serveStatic({ root })(c, next)
  })

  app.get('*', (c, next) => {
    if (isApiPath(c.req.path)) return next()
    return serveStatic({ root, path: 'index.html' })(c, next)
  })

  return app
}
