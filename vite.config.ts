import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { sparkApiPlugin } from './server/vite-plugin'

export default defineConfig({
  // vue 渲染页面，sparkApi 在 dev / preview 下提供 /api 接口
  plugins: [vue(), sparkApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.ts', 'server/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}', 'server/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'server/**/*.spec.ts',
        'server/index.ts',
        'server/vite-plugin.ts',
        'src/test/**',
        'src/main.ts',
        'src/env.d.ts',
      ],
    },
  },
})
