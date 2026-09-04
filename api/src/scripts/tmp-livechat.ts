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

  // `livechat` é nativo do Bitrix: se estiver ativo na 230, dá um link público para
  // escrever de fora sem contratar conector nenhum.
  for (const conector of ['livechat', 'hubthink_thinkzap']) {
    try {
      const st = await c.callMethod<{ result?: Record<string, unknown> }>(
        'imconnector.status',
        { LINE: '230', CONNECTOR: conector },
      )
      console.log(`STATUS_230_${conector}:`, JSON.stringify(st.result))
    } catch (e) {
      console.log(
        `STATUS_230_${conector} FALHA:`,
        e instanceof Error ? e.message.slice(0, 120) : '',
      )
    }
  }

  // Em qual linha o livechat está ativo, se houver.
  try {
    const cfgs = await c.callMethod<{ result?: Array<Record<string, unknown>> }>(
      'imopenlines.config.list.get',
      {},
    )
    const ativas = (cfgs.result ?? []).filter(l => String(l.ACTIVE) === 'Y')
    console.log(
      'LINHAS_ATIVAS:',
      JSON.stringify(
        ativas.map(l => ({
          ID: l.ID,
          NOME: l.LINE_NAME,
          BOT: l.WELCOME_BOT_ID,
          BOT_ON: l.WELCOME_BOT_ENABLE,
        })),
      ),
    )

    for (const linha of ativas) {
      try {
        const st = await c.callMethod<{ result?: { STATUS?: unknown } }>(
          'imconnector.status',
          { LINE: String(l_id(linha)), CONNECTOR: 'livechat' },
        )
        if (st.result?.STATUS) {
          console.log(
            `LIVECHAT_ATIVO_EM: linha ${l_id(linha)} (${String(linha.LINE_NAME)})`,
          )
        }
      } catch {
        // linha sem livechat: silêncio, o interesse é só nas que têm
      }
    }
  } catch (e) {
    console.log('CONFIG_LIST FALHA:', e instanceof Error ? e.message : '')
  }
}

function l_id(linha: Record<string, unknown>): string {
  return String(linha.ID ?? '')
}

main()
  .catch((e: unknown) => {
    console.error('FALHOU:', e instanceof Error ? e.message : JSON.stringify(e))
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
