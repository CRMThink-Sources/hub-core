import 'dotenv/config'
import { prisma } from '@/config/prisma.js'

async function main() {
  // Nomes de model do Prisma variam; descobre os que existem antes de consultar.
  const models = Object.keys(prisma).filter(
    k => !k.startsWith('$') && !k.startsWith('_'),
  )
  console.log(
    'MODELS_LINHA:',
    JSON.stringify(models.filter(m => /line|linha|connect/i.test(m))),
  )
}

main()
  .catch((e: unknown) => {
    console.error('FALHOU:', e instanceof Error ? e.message : JSON.stringify(e))
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
