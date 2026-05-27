import 'dotenv/config'

import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { MigrateAudioWidgetToImTextarea } from '@/modules/thinkzap/application/migrate-audio-widget-to-im-textarea'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'

const BUFFER_MS = 5 * 60 * 1000

function parseArgs(argv: string[]) {
  const domainArg = argv.find(arg => arg.startsWith('--domain='))
  const domain = domainArg?.split('=')[1]?.trim() || null
  const all = argv.includes('--all')

  return { domain, all }
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
  const { domain, all } = parseArgs(process.argv.slice(2))

  if (!domain && !all) {
    console.error(
      'Usage: yarn migrate:audio-im-textarea --domain=empresa.bitrix24.com.br',
    )
    console.error('   or: yarn migrate:audio-im-textarea --all')
    process.exit(1)
  }

  const apps = await prisma.app.findMany({
    where: {
      appCode: { code: env.appCodes.thinkzap },
      ...(domain ? { domain: { name: domain } } : {}),
    },
    include: {
      domain: true,
      credential: true,
      appCode: true,
    },
  })

  if (apps.length === 0) {
    console.log('No ThinkZap installations found for the given filter.')
    return
  }

  const credentialRepo = new PrismaCredentialRepository()
  const migration = new MigrateAudioWidgetToImTextarea()

  for (const app of apps) {
    const portal = app.domain.name

    if (!app.credential) {
      console.warn(`[skip] ${portal}: credential not found`)
      continue
    }

    try {
      const accessToken = await ensureFreshAccessToken(
        {
          appId: app.id,
          clientId: app.appCode.code,
          clientSecret: app.appCode.secret,
          accessToken: app.credential.accessToken ?? '',
          refreshToken: app.credential.refreshToken,
          expiresAt: app.credential.expiresAt,
        },
        credentialRepo,
      )

      const client = new BitrixRestClient(portal, accessToken)
      await migration.execute(client)
      console.log(`[ok] ${portal}: migrated audio widget to IM_TEXTAREA`)
    } catch (error) {
      console.error(`[error] ${portal}:`, (error as Error).message ?? error)
    }
  }
}

main()
  .catch(error => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
