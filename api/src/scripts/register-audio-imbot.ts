import 'dotenv/config'

import { env } from '@/config/env'
import { buildAudioImTextareaPlacementBindParams } from '@/modules/thinkzap/application/build-audio-im-textarea-placement-params'
import { ensureImbotAudioApp } from '@/modules/thinkzap/application/ensure-imbot-audio-app'
import { findThinkzapBotId } from '@/modules/thinkzap/application/get-or-create-thinkzap-bot'
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

  if (/ngrok-free\.(app|dev)/i.test(env.bitrix.iframeAudio.url)) {
    console.warn(
      '[register:audio-imbot] BITRIX_IFRAME_AUDIO_URL usa ngrok free; o iframe do Bitrix pode falhar nos chunks /_next (Unexpected token "<"). Use cloudflared ou homolog — docs/DEV-BITRIX.md',
    )
  }

  const domainRow = await prisma.domain.findFirst({ where: { name: domain } })
  if (!domainRow) {
    console.error(`Domain nao encontrado: ${domain}`)
    process.exit(1)
  }

  const thinkzapCode = env.appCodes.thinkzap
  const appCode = await prisma.appCode.findFirst({
    where: {
      OR: [
        { code: thinkzapCode },
        { id: thinkzapCode },
        { id: 'crmthink.thinkzap' },
      ],
    },
  })
  if (!appCode) {
    console.error(
      `App code ThinkZap nao encontrado (code/id: ${thinkzapCode}). Verifique core_app_codes.`,
    )
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

  const botId = await findThinkzapBotId(client)

  if (check) {
    const params = buildAudioImTextareaPlacementBindParams()
    console.log('[check] placement.bind params:', params)
    console.log(
      '[check] UI: painel acima do campo de mensagem no chat -> ThinkZap Audio',
    )
    process.exit(0)
  }

  const result = await ensureImbotAudioApp(client, botId)
  console.log(`[register:audio-imbot] result=${result}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
