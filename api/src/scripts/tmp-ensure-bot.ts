import 'dotenv/config'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaBotFlowBotRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow-bot.repository'
import { ensureBotFlowBot } from '@/modules/thinkzap/application/ensure-bot-flow-bot'

const BUF = 5 * 60 * 1000
const DOMAIN = 'crmthinkers.bitrix24.com.br'

async function main() {
  const d = await prisma.domain.findFirst({ where: { name: DOMAIN } })
  if (!d) throw new Error('domain')
  const code = await prisma.appCode.findFirst({
    where: {
      OR: [
        { code: env.appCodes.thinkzap },
        { id: env.appCodes.thinkzap },
        { id: 'crmthink.thinkzap' },
      ],
    },
  })
  if (!code) throw new Error('appCode')
  const app = await prisma.app.findFirst({
    where: { domainId: d.id, appCodeId: code.id },
  })
  if (!app) throw new Error('app')

  const repo = new PrismaCredentialRepository()
  const cred = await repo.get({ appId: app.id })
  if (!cred?.accessToken) throw new Error('cred')
  let token = cred.accessToken
  if (cred.expiresAt <= new Date(Date.now() + BUF)) {
    const r = await new BitrixOAuthClient().refresh({
      clientId: cred.clientId,
      clientSecret: cred.clientSecret,
      refreshToken: cred.refreshToken,
    })
    await repo.update({
      appId: cred.appId,
      clientId: cred.clientId,
      clientSecret: cred.clientSecret,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresAt: r.expiresAt,
    })
    token = r.accessToken
  }

  const client = BitrixClient.withUserToken(DOMAIN, token)
  const bots = new PrismaBotFlowBotRepository()

  console.log('WEBHOOK ESPERADO:', env.bitrix.botWebhookUrl)

  const bot = await ensureBotFlowBot(
    client,
    { get: bots, save: bots },
    {
      appId: app.id,
      webhookUrl: env.bitrix.botWebhookUrl,
      flowName: '123',
    },
  )

  console.log('RESULTADO:', JSON.stringify(bot))
}

main()
  .catch((e: unknown) => {
    console.error('FALHOU:', e instanceof Error ? e.message : JSON.stringify(e))
    if (e instanceof Error && e.stack) console.error(e.stack)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
