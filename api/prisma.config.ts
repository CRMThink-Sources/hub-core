import 'dotenv/config'
import { defineConfig } from '@prisma/config'

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (url?.length) return url

  const host = process.env.DATABASE_HOST ?? ''
  const port = process.env.DATABASE_PORT ?? '3306'
  const user = process.env.DATABASE_USER ?? ''
  const password = process.env.DATABASE_PASSWORD ?? ''
  const database = process.env.DATABASE_NAME ?? ''

  if (!host || !database || !user) {
    throw new Error(
      'Defina DATABASE_URL no .env ou DATABASE_HOST, DATABASE_USER e DATABASE_NAME.',
    )
  }

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
})
