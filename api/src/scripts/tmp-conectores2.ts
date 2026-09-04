import 'dotenv/config'
import { prisma } from '@/config/prisma.js'

async function main() {
  const cons = await prisma.connector.findMany()
  console.log('TOTAL:', cons.length)
  for (const c of cons) {
    const row = c as unknown as Record<string, unknown>
    const resumo: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (/token|secret|password|key/i.test(k)) {
        resumo[k] = v ? '***' : null
        continue
      }
      resumo[k] = v instanceof Date ? v.toISOString() : v
    }
    console.log('CONECTOR:', JSON.stringify(resumo))
  }
}

main()
  .catch((e: unknown) => {
    console.error('FALHOU:', e instanceof Error ? e.message : JSON.stringify(e))
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
