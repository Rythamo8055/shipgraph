import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/ui/**/*.test.{ts,tsx}'],
    exclude: ['tests/ui/__fixtures__/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
