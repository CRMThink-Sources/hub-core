import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    /**
     * Do mais específico para o mais genérico: o Vite resolve alias por prefixo,
     * na ordem declarada, e o primeiro que casa vence. Com `'@'` no topo,
     * `@/prisma/client` casava com ele e virava `src/prisma/client`, que não
     * existe — qualquer teste que importasse a cadeia do Prisma falhava no import
     * com "Cannot find package '@/prisma/client'".
     */
    alias: {
      '@/prisma/client': path.resolve(
        __dirname,
        './prisma/generated/prisma/client',
      ),
      '@/prisma': path.resolve(__dirname, './prisma/generated/prisma'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
