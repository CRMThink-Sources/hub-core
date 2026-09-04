import 'dotenv/config'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'

const BUF = 5 * 60 * 1000
const DOMAIN = 'crmthinkers.bitrix24.com.br'

async function makeClient(): Promise<BitrixClient> {
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
  return BitrixClient.withUserToken(DOMAIN, token)
}

async function main() {
  const c = await makeClient()
  console.log('CODIGO_CONECTOR_ENV:', env.bitrix.connector.code)

  const cfgs = await c.callMethod<{ result?: Array<Record<string, unknown>> }>(
    'imopenlines.config.list.get',
    {},
  )
  const ativas = (cfgs.result ?? []).filter(l => String(l.ACTIVE) === 'Y')

  // Os dois códigos do nosso conector: o do env e o par local/dev.
  const codigos = [
    env.bitrix.connector.code,
    'hubthink_thinkzap',
    'hubthink_thinkzap_dev',
  ].filter((v, i, a) => a.indexOf(v) === i)

  for (const linha of ativas) {
    const id = String(linha.ID ?? '')
    for (const conector of codigos) {
      try {
        const st = await c.callMethod<{
          result?: { STATUS?: unknown; CONFIGURED?: unknown }
        }>('imconnector.status', { LINE: id, CONNECTOR: conector })
        if (st.result?.STATUS || st.result?.CONFIGURED) {
          console.log(
            `ACHOU: linha ${id} (${String(linha.LINE_NAME)}) conector=${conector} STATUS=${String(st.result?.STATUS)} CONFIGURED=${String(st.result?.CONFIGURED)} BOT=${String(linha.WELCOME_BOT_ID)} BOT_ON=${String(linha.WELCOME_BOT_ENABLE)}`,
          )
        }
      } catch {
        // linha sem esse conector
      }
    }
  }
}

main()
  .catch((e: unknown) => {
    console.error('FALHOU:', e instanceof Error ? e.message : JSON.stringify(e))
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
