import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    exclude: ['.vercel/**', 'node_modules/**'],
    coverage: {
      include: ['src/**/*.ts']
    }
  }
})
