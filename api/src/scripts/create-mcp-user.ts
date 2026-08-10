import 'dotenv/config'

import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import { hashPassword } from '@/modules/portal/application/password.service.js'

type Args = {
  email: string
  name: string
  password: string
  domain: string
  isAdmin: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const index = args.indexOf(flag)
    if (index === -1) return undefined
    return args[index + 1]
  }

  const email = get('--email') ?? ''
  const name = get('--name') ?? 'Suporte'
  const password = get('--password') ?? ''
  // Nome do domínio em core_domains (ex: cliente.bitrix24.com.br).
  const domain = get('--domain') ?? ''
  const isAdmin = args.includes('--admin')

  if (!email || !password || !domain) {
    console.error(
      'Uso: tsx src/scripts/create-mcp-user.ts --email <email> --password <senha> --domain <dominio> [--name <nome>] [--admin]',
    )
    process.exit(1)
  }

  return { email: email.toLowerCase().trim(), name, password, domain, isAdmin }
}

async function main() {
  const { email, name, password, domain, isAdmin } = parseArgs()

  const domainRow = await prisma.domain.findUnique({ where: { name: domain } })
  if (!domainRow) {
    console.error(`Domínio não encontrado em core_domains: ${domain}`)
    process.exit(1)
  }

  const existing = await prisma.mcpUser.findUnique({ where: { email } })
  if (existing) {
    console.error(`Usuário MCP já existe: ${email}`)
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.mcpUser.create({
    data: {
      id: randomUUID(),
      email,
      name,
      passwordHash,
      domainId: domainRow.id,
      isAdmin,
      isActive: true,
    },
  })

  console.log(
    `Usuário MCP criado: ${user.email} (${user.id}) — domínio ${domain}${isAdmin ? ' — ADMIN' : ''}`,
  )
}

main()
  .catch(error => {
    console.error('Falha ao criar usuário MCP:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
