import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: {
      // tsconfig paths: "@/*" → "./src/*"
      '@': path.resolve(__dirname, 'src'),
      // 테스트에서 app/ 라우트를 절대경로로 import하기 위한 alias
      '~app': path.resolve(__dirname, 'app'),
    },
  },
})
