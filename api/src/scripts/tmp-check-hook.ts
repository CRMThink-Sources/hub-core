import 'dotenv/config'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'

async function main() {
  const bots = await prisma.thinkzapBotFlowBot.findMany({
    select: { bitrixBotId: true, webhookUrl: true },
  })
  console.log('ESPERADO :', env.bitrix.botWebhookUrl)
  for (const b of bots) {
    const ok = b.webhookUrl === env.bitrix.botWebhookUrl
    console.log(
      `BOT ${b.bitrixBotId} : ${b.webhookUrl} ${ok ? '[BATE]' : '[DIFERE]'}`,
    )
  }

  const sessoes = await prisma.thinkzapBotSession.count()
  console.log('SESSOES  :', sessoes)
}

main()
  .catch((e: unknown) => {
    console.error('FALHOU:', e instanceof Error ? e.message : JSON.stringify(e))
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
