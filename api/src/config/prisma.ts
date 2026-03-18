import { PrismaClient } from '../prisma/generated/prisma/client.js'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST ?? '',
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER ?? '',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? '',
})

export const prisma = new PrismaClient({ adapter })
