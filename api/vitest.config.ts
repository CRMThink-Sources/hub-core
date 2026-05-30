import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/prisma/client': path.resolve(
        __dirname,
        './prisma/generated/prisma/client',
      ),
      '@/prisma': path.resolve(__dirname, './prisma/generated/prisma'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
