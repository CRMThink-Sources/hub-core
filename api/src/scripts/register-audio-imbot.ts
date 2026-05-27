import 'dotenv/config'

import { env } from '@/config/env'
import { ensureImbotAudioApp } from '@/modules/thinkzap/application/ensure-imbot-audio-app'
import { GetOrCreateThinkzapBot } from '@/modules/thinkzap/application/get-or-create-thinkzap-bot'
import { buildImbotAudioAppParams } from '@/modules/thinkzap/application/build-imbot-audio-app-params'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { prisma } from '@/config/prisma.js'

const BUFFER_MS = 5 * 60 * 1000

function parseArgs(argv: string[]) {
  const domainArg = argv.find(arg => arg.startsWith('--domain='))
  const domain = domainArg?.split('=')[1]?.trim() || null
  const check = argv.includes('--check')

  return { domain, check }
}

async function ensureFreshAccessToken(
  credential: {
    appId: string
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
    expiresAt: Date
  },
  credentialRepo: PrismaCredentialRepository,
): Promise<string> {
  const buffer = new Date(Date.now() + BUFFER_MS)
  if (credential.expiresAt > buffer) {
    return credential.accessToken
  }

  const oauth = new BitrixOAuthClient()
  const refreshed = await oauth.refresh({
    clientId: credential.clientId,
    clientSecret: credential.clientSecret,
    refreshToken: credential.refreshToken,
  })

  await credentialRepo.update({
    appId: credential.appId,
    clientId: credential.clientId,
    clientSecret: credential.clientSecret,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  })

  return refreshed.accessToken
}

async function main() {
  const { domain, check } = parseArgs(process.argv.slice(2))

  if (!domain) {
    console.error(
      'Uso: yarn register:audio-imbot --domain=portal.bitrix24.com.br [--check]',
    )
    process.exit(1)
  }

  if (!env.bitrix.iframeAudio.url || !env.bitrix.iframeAudio.hash) {
    console.error(
      'Configure BITRIX_IFRAME_AUDIO_URL e BITRIX_IFRAME_AUDIO_HASH',
    )
    process.exit(1)
  }

  const domainRow = await prisma.domain.findFirst({ where: { name: domain } })
  if (!domainRow) {
    console.error(`Domain nao encontrado: ${domain}`)
    process.exit(1)
  }

  const appCode = await prisma.appCode.findFirst({
    where: { code: env.appCodes.thinkzap },
  })
  if (!appCode) {
    console.error(`App code nao encontrado: ${env.appCodes.thinkzap}`)
    process.exit(1)
  }

  const installedApp = await prisma.app.findFirst({
    where: { domainId: domainRow.id, appCodeId: appCode.id },
  })
  if (!installedApp) {
    console.error('ThinkZap nao instalado neste portal')
    process.exit(1)
  }

  const credentialRepo = new PrismaCredentialRepository()
  const credential = await credentialRepo.get({ appId: installedApp.id })
  if (!credential?.accessToken) {
    console.error('Credential sem access_token')
    process.exit(1)
  }

  const accessToken = await ensureFreshAccessToken(
    {
      appId: credential.appId,
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
      expiresAt: credential.expiresAt,
    },
    credentialRepo,
  )

  const client = new BitrixRestClient(domain, accessToken)

  const getBot = new GetOrCreateThinkzapBot()
  const botId = await getBot.execute(client)
  if (!botId) {
    console.error('Bot ThinkZap nao encontrado/criado')
    process.exit(1)
  }

  if (check) {
    const params = buildImbotAudioAppParams(botId)
    console.log('[check] imbot.app.register params:', {
      BOT_ID: params.BOT_ID,
      CODE: params.CODE,
      CONTEXT: params.CONTEXT,
      IFRAME: params.IFRAME,
      IFRAME_WIDTH: params.IFRAME_WIDTH,
      IFRAME_HEIGHT: params.IFRAME_HEIGHT,
    })
    console.log(
      '[check] UI: area do textarea no Open Lines -> icone ThinkZap Audio',
    )
    process.exit(0)
  }

  const result = await ensureImbotAudioApp(client, botId)
  console.log(`[register:audio-imbot] botId=${botId} result=${result}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
