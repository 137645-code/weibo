import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createServerApp } from './serverApp'
import { createPostStore } from './store'

const DEFAULT_PORT = 8787
const parsedPort = Number.parseInt(process.env.PORT ?? '', 10)
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT

const here = fileURLToPath(new URL('.', import.meta.url))
// 有构建产物时顺带托管静态资源，前后端同源，无需 CORS 或代理
const app = createServerApp({ store: createPostStore(), distDir: resolve(here, '../dist') })

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[spark] api ready on http://localhost:${info.port}`)
  // 内存存储：进程重启后数据清空，属于预期行为
})
