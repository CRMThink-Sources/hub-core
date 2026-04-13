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
    return 'mysql://placeholder:placeholder@localhost:3306/placeholder'
  }

<<<<<<< Updated upstream
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
=======
  return `mysql://${encodeURIComponent(user)}:$npx prisma migrate deploy --schema=prisma/schema.prisma{encodeURIComponent(password)}@${host}:${port}/${database}`
>>>>>>> Stashed changes
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
