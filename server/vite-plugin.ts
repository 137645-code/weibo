import { getRequestListener } from '@hono/node-server'
import type { Connect, IncomingMessage, Plugin, ServerResponse } from 'vite'
import { createApp } from './app'
import { createPostStore } from './store'

function isApiPath(url: string | undefined): boolean {
  if (!url) return false

  const path = url.split('?')[0]
  return path === '/api' || path.startsWith('/api/')
}

/** 把 Hono 应用挂到 Vite 的中间件栈上，dev 与 preview 共用同一个内存实例 */
function mountApi(
  middlewares: Connect.Server,
  listener: (req: IncomingMessage, res: ServerResponse) => void,
): void {
  middlewares.use((req, res, next) => {
    if (!isApiPath(req.url)) {
      next()
      return
    }

    try {
      listener(req, res)
    } catch (error) {
      next(error)
    }
  })
}

/**
 * 开发与预览时提供 /api 接口：不需要额外起进程，也不用配代理，
 * 前端始终按同源相对路径请求。
 */
export function sparkApiPlugin(): Plugin {
  const listener = getRequestListener(createApp({ store: createPostStore() }).fetch)

  return {
    name: 'spark-api',
    configureServer(server) {
      mountApi(server.middlewares, listener)
    },
    configurePreviewServer(server) {
      mountApi(server.middlewares, listener)
    },
  }
}
