import 'dotenv/config'

import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'

const SALT_ROUNDS = 12

function parseArgs(): { email: string; name: string; password: string } {
  const args = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const index = args.indexOf(flag)
    if (index === -1) return undefined
    return args[index + 1]
  }

  const email = get('--email') ?? process.env.PORTAL_BOOTSTRAP_EMAIL ?? ''
  const name = get('--name') ?? process.env.PORTAL_BOOTSTRAP_NAME ?? 'Admin'
  const password =
    get('--password') ?? process.env.PORTAL_BOOTSTRAP_PASSWORD ?? ''

  if (!email || !password) {
    console.error(
      'Usage: tsx src/scripts/create-portal-user.ts --email <email> --password <password> [--name <name>]',
    )
    console.error(
      'Or set PORTAL_BOOTSTRAP_EMAIL and PORTAL_BOOTSTRAP_PASSWORD env vars.',
    )
    process.exit(1)
  }

  return { email: email.toLowerCase().trim(), name, password }
}

async function main() {
  const { email, name, password } = parseArgs()
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const existing = await prisma.portalUser.findUnique({ where: { email } })
  if (existing) {
    console.error(`Portal user already exists: ${email}`)
    process.exit(1)
  }

  const user = await prisma.portalUser.create({
    data: {
      id: randomUUID(),
      email,
      name,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log(`Portal user created: ${user.email} (${user.id})`)
}

main()
  .catch(error => {
    console.error('Failed to create portal user:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
