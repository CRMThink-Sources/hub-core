import 'dotenv/config'

import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { crmEntitiesFromDialog } from '@/modules/thinkzap/domain/bot-flow/crm-entities'
import { openLineIdFromDialog } from '@/modules/thinkzap/domain/bot-flow/open-line-entity-id'

/**
 * Sonda o `imopenlines.dialog.get` num chat real, que é a única chamada do turno do bot
 * que não dá para verificar por teste unitário.
 *
 * Responde três perguntas que decidem se o fluxo roda, e que só o portal responde:
 *
 * 1. **A credencial do app tem acesso ao chat do canal aberto?** O turno inteiro depende
 *    desta chamada: sem o `entity_id` não há linha, sem linha não há vínculo, e o
 *    processor sai em `warn` sem rodar nada. O app não é participante da sessão, e esse
 *    guard já recusou `imbot.message.add` neste mesmo cenário — ver
 *    `postOpenChannelSystemNotice`. Se recusar aqui, o caminho é usar o
 *    `bot.auth.access_token` que o evento traz, em vez da credencial da instalação.
 * 2. **O `entity_data_2` vem, e na forma esperada?** É o que alimenta o bloco
 *    "Já é cliente?". O campo não está na doc do método — foi observado numa resposta
 *    real —, então não é contrato: pode não vir.
 * 3. **O `entity_id` posicional casa com a linha esperada?**
 *
 * Só lê. Não registra bot, não altera linha, não fala em chat nenhum.
 *
 * Uso:
 *   yarn tsx src/scripts/probe-dialog-get.ts --domain=portal.bitrix24.com.br --chat=9474
 *   yarn tsx src/scripts/probe-dialog-get.ts --domain=... --chat=9474 --line=224
 */

const TOKEN_BUFFER_MS = 5 * 60 * 1000

type Row = {
  checagem: string
  status: 'OK' | 'FALHA' | 'INFO'
  detalhe: string
}

function parseArgs(argv: string[]) {
  const value = (name: string): string | null =>
    argv
      .find(arg => arg.startsWith(`--${name}=`))
      ?.split('=')
      .slice(1)
      .join('=')
      .trim() || null

  return {
    domain: value('domain'),
    chat: value('chat'),
    /** Linha esperada, quando se quer conferir o `entity_id` contra ela. */
    line: value('line'),
  }
}

async function resolveClient(domain: string): Promise<BitrixClient> {
  const domainRow = await prisma.domain.findFirst({ where: { name: domain } })
  if (!domainRow) throw new Error(`Domain não encontrado: ${domain}`)

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
    throw new Error(`App code ThinkZap não encontrado: ${thinkzapCode}`)
  }

  const installedApp = await prisma.app.findFirst({
    where: { domainId: domainRow.id, appCodeId: appCode.id },
  })
  if (!installedApp) throw new Error('ThinkZap não instalado neste portal')

  const credentialRepo = new PrismaCredentialRepository()
  const credential = await credentialRepo.get({ appId: installedApp.id })
  if (!credential?.accessToken) throw new Error('Credential sem access_token')

  let accessToken = credential.accessToken
  if (credential.expiresAt <= new Date(Date.now() + TOKEN_BUFFER_MS)) {
    const refreshed = await new BitrixOAuthClient().refresh({
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
    accessToken = refreshed.accessToken
  }

  return BitrixClient.withUserToken(domain, accessToken)
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : texto(err)

/** `String({})` daria `[object Object]`, que passaria por código de erro válido. */
function texto(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return value == null ? '' : JSON.stringify(value)
}

/** Escopos do app; `imbot` faltando é a causa mais comum de falha na publicação. */
async function checkScopes(client: BitrixClient, rows: Row[]): Promise<void> {
  try {
    const response = await client.callMethod<unknown>('scope', {})
    const lista = (Array.isArray(response) ? response : []).map(String)
    const faltando = ['imbot', 'imopenlines'].filter(
      scope => !lista.includes(scope),
    )

    rows.push({
      checagem: 'escopos imbot + imopenlines',
      status: faltando.length ? 'FALHA' : 'OK',
      detalhe: faltando.length
        ? `faltando: ${faltando.join(', ')} — exige reinstalar o app`
        : lista.join(', '),
    })
  } catch (err) {
    rows.push({
      checagem: 'escopos imbot + imopenlines',
      status: 'FALHA',
      detalhe: errorMessage(err),
    })
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (!args.domain || !args.chat) {
    console.error(
      'Uso: --domain=portal.bitrix24.com.br --chat=9474 [--line=224]',
    )
    process.exitCode = 1
    return
  }

  const rows: Row[] = []
  const client = await resolveClient(args.domain)

  await checkScopes(client, rows)

  let dialog: unknown
  try {
    dialog = await client.callMethod('imopenlines.dialog.get', {
      CHAT_ID: args.chat,
    })

    rows.push({
      checagem: '1. app acessa o chat do canal aberto',
      status: 'OK',
      detalhe: 'dialog.get respondeu sem erro',
    })
  } catch (err) {
    rows.push({
      checagem: '1. app acessa o chat do canal aberto',
      status: 'FALHA',
      detalhe: `${errorMessage(err)} — se for acesso/CANCELED, o turno precisa do token do bot (bot.auth.access_token do evento), não da credencial do app`,
    })

    console.log('\n=== RESPOSTA CRUA ===')
    console.log('(sem resposta: a chamada lançou)')
    console.table(rows)
    return
  }

  // Recusa por HTTP 200 com `error` no corpo não passa pelo `catch`: é a forma que já
  // recusou `imbot.message.add` neste mesmo cenário.
  const corpo = dialog as { error?: unknown; error_description?: unknown }
  if (corpo?.error) {
    rows.push({
      checagem: '1b. recusa com HTTP 200 no corpo',
      status: 'FALHA',
      detalhe: `error=${texto(corpo.error)} — ${texto(corpo.error_description)}`,
    })
  }

  const lineId = openLineIdFromDialog(dialog)
  rows.push({
    checagem: '2. entity_id posicional → linha',
    status: lineId ? 'OK' : 'FALHA',
    detalhe: lineId
      ? args.line
        ? lineId === args.line
          ? `linha ${lineId} (bate com --line)`
          : `linha ${lineId} DIFERE de --line=${args.line}`
        : `linha ${lineId}`
      : 'não foi possível extrair a linha do entity_id',
  })

  const result = (dialog as { result?: Record<string, unknown> })?.result
  const entityData2 = result?.entity_data_2

  rows.push({
    checagem: '3. entity_data_2 presente',
    status: typeof entityData2 === 'string' && entityData2 ? 'OK' : 'FALHA',
    detalhe:
      typeof entityData2 === 'string' && entityData2
        ? entityData2
        : 'ausente ou vazio — o bloco "Já é cliente?" sempre cairá no ramo "não é cliente"',
  })

  const crm = crmEntitiesFromDialog(dialog)
  rows.push({
    checagem: '4. vínculos de CRM lidos',
    status: crm.contactId ? 'OK' : 'INFO',
    detalhe: `contato=${crm.contactId || '(vazio)'} lead=${crm.leadId || '(vazio)'} empresa=${crm.companyId || '(vazio)'} negócio=${crm.dealId || '(vazio)'}`,
  })

  // `contatoId` e não `leadId`: o Bitrix abre um lead sozinho no primeiro contato, então
  // lead preenchido não distingue cliente de desconhecido.
  rows.push({
    checagem: '5. ramo que o bloco "Já é cliente?" tomaria',
    status: 'INFO',
    detalhe: crm.contactId
      ? 'JÁ É CLIENTE (contato preenchido)'
      : 'NÃO É CLIENTE (sem contato) — confira se esse número já é contato no CRM',
  })

  console.log('\n=== RESPOSTA CRUA de imopenlines.dialog.get ===')
  console.log(JSON.stringify(dialog, null, 2))

  console.log('\n=== CHECAGENS ===')
  console.table(rows)
}

main()
  .catch((err: unknown) => {
    console.error('FALHOU:', errorMessage(err))
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
