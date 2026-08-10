// Reseta a senha de um usuário MCP existente (core_mcp_users). Sem --email, exige
// que haja exatamente um usuário. Uso:
//   tsx src/scripts/reset-mcp-password.ts --password <senha> [--email <email>]
import { prisma } from '@/config/prisma.js'
import { hashPassword } from '@/modules/portal/application/password.service.js'

function get(flag: string): string | undefined {
  const args = process.argv.slice(2)
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

async function main(): Promise<void> {
  const password = get('--password') ?? ''
  const email = get('--email')?.toLowerCase().trim()
  if (!password) {
    console.error(
      'Uso: tsx src/scripts/reset-mcp-password.ts --password <senha> [--email <email>]',
    )
    process.exit(1)
  }

  const user = email
    ? await prisma.mcpUser.findUnique({ where: { email } })
    : await (async () => {
        const all = await prisma.mcpUser.findMany({ take: 2 })
        if (all.length !== 1) {
          console.error(
            `Esperado 1 usuário MCP (achei ${all.length}). Passe --email.`,
          )
          process.exit(1)
        }
        return all[0]
      })()

  if (!user) {
    console.error(`Usuário MCP não encontrado${email ? `: ${email}` : ''}`)
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  await prisma.mcpUser.update({
    where: { id: user.id },
    data: { passwordHash },
  })
  console.log(`SENHA_RESETADA email=${user.email} domainId=${user.domainId}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
