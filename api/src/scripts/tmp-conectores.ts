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

  // Conectores ligados na linha 230: é o que traz mensagem de fora para o canal.
  try {
    const st = await c.callMethod('imconnector.status', {
      LINE: '230',
      CONNECTOR: env.bitrix.connector.code,
    })
    console.log('STATUS_NOSSO_CONECTOR_230:', JSON.stringify(st))
  } catch (e) {
    console.log('STATUS FALHA:', e instanceof Error ? e.message : '')
  }

  try {
    const lista = await c.callMethod('imconnector.list', {})
    console.log('CONECTORES_DISPONIVEIS:', JSON.stringify(lista).slice(0, 1500))
  } catch (e) {
    console.log('LIST FALHA:', e instanceof Error ? e.message : '')
  }

  // Linhas do nosso lado: provider e telefone de cada uma.
  const linhas = await prisma.thinkzapLine.findMany({
    select: {
      id: true,
      bitrixLineId: true,
      provider: true,
      phone: true,
      status: true,
    },
  })
  console.log('LINHAS_BANCO:', JSON.stringify(linhas))
}

main()
  .catch((e: unknown) => {
    console.error('FALHOU:', e instanceof Error ? e.message : JSON.stringify(e))
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
