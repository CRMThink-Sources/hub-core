import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default {
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  test: {
    include: [
      'app/**/*.test.ts',
      'shared/**/*.test.ts',
      'bitrix/**/*.test.ts',
      'providers/**/*.test.ts',
      // `lib/` tem lógica (formatação de data, tipos do portal) e ficava fora da
      // coleta — um teste escrito ali passava a existir sem nunca rodar.
      'lib/**/*.test.ts',
    ],
    environment: 'node',
  },
}
