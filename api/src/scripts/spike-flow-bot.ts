import 'dotenv/config'

import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { prisma } from '@/config/prisma.js'
import type { HandoffTarget } from '@/modules/thinkzap/domain/bot-flow/flow'
import { transferParams } from '@/modules/thinkzap/domain/bot-flow/transfer-params'

/**
 * Spike F0 do ThinkBot — ver
 * `docs/superpowers/plans/2026-08-19-thinkzap-gerador-de-bot-plan.md`.
 *
 * Responde, num portal de teste, se o plano "bot nativo de canal aberto" fecha: o
 * Bitrix aceita nosso bot como welcome bot da linha, o evento chega no nosso
 * webhook, a fala do bot atravessa o conector até o WhatsApp, e o handoff devolve a
 * sessão para a fila com histórico. Mede também o que a fala custa de request.
 *
 * Estágios separados porque duas checagens acontecem fora do processo: o cliente
 * mandando WhatsApp (o log da API observa) e a mensagem chegando no celular (o olho
 * confere).
 *
 * Uso:
 *   yarn spike:flow-bot --domain=portal.bitrix24.com.br --stage=lines
 *   yarn spike:flow-bot --domain=... --stage=setup --line=12
 *   yarn spike:flow-bot --domain=... --stage=status --line=12
 *   yarn spike:flow-bot --domain=... --stage=say --chat=1234 --text="1 Suporte"
 *   yarn spike:flow-bot --domain=... --stage=handoff --chat=1234
 *   yarn spike:flow-bot --domain=... --stage=handoff --chat=1234 --user=15
 *   yarn spike:flow-bot --domain=... --stage=handoff --chat=1234 --queue=7
 *   yarn spike:flow-bot --domain=... --stage=cleanup --line=12
 */

const BOT_CODE = 'thinkzap-flow-spike'
/**
 * Token do bot do spike, fixo de propósito.
 *
 * `botToken` é entrada do `Bot.register`, não retorno: a doc pede que o chamador
 * escolha a chave, e ela passa a ser exigida em todo `imbot.v2*` por webhook. Fixo aqui
 * para `--stage=handoff` funcionar depois de `--stage=setup` sem guardar estado; em
 * produção `ensureBotFlowBot` gera aleatório e grava no banco.
 */
const SPIKE_BOT_TOKEN = 'thinkzap-flow-spike-token'
const BOT_NAME = 'ThinkZap Fluxo (spike)'
const TOKEN_BUFFER_MS = 5 * 60 * 1000

const STAGES = [
  'lines',
  'setup',
  'status',
  'say',
  'handoff',
  'cleanup',
] as const
type Stage = (typeof STAGES)[number]

type Row = {
  checagem: string
  status: 'OK' | 'FALHA' | 'INFO'
  detalhe: string
}

/**
 * Consumo de request, que é o limite mais apertado do plano: 2 req/s por portal nos
 * planos comuns, e `operating` acumulado por método com teto de ~480 s.
 */
type CallStat = {
  metodo: string
  ms: number
  operating: number | null
  resetAt: string | null
}

const stats: CallStat[] = []

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
    stage: (value('stage') ?? 'status') as Stage,
    line: value('line'),
    chat: value('chat'),
    text: value('text'),
    /** Alvos de handoff. Ausentes = fila da própria linha. */
    user: value('user'),
    queue: value('queue'),
    /** `CLIENT_ID` do bot, quando `Bot.list` não o devolve. */
    token: value('token'),
    /** Handler do bot. Padrão é o mesmo webhook do conector. */
    webhook: value('webhook') ?? env.bitrix.webhookUrl,
  }
}

/**
 * Chamada instrumentada.
 *
 * Usa `BitrixClient` de propósito: ele devolve o corpo inteiro, e é o bloco `time`
 * que carrega `operating` / `operating_reset_at` — exatamente o que o spike precisa
 * medir. O `BitrixRestClient` desembrulha `result` e descarta esse bloco.
 */
async function call<T = unknown>(
  client: BitrixClient,
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const startedAt = Date.now()
  const body = await client.callMethod<{
    result?: T
    error?: string
    error_description?: string
    time?: { operating?: number; operating_reset_at?: number }
  }>(method, params)
  const ms = Date.now() - startedAt

  stats.push({
    metodo: method,
    ms,
    operating: body.time?.operating ?? null,
    resetAt: body.time?.operating_reset_at
      ? new Date(body.time.operating_reset_at * 1000).toISOString()
      : null,
  })

  if (body.error) {
    throw new Error(
      `${method}: ${body.error} — ${body.error_description ?? ''}`,
    )
  }

  return (body.result ?? body) as T
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

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** Campo de resposta do Bitrix legível numa tabela, sem `[object Object]`. */
const str = (value: unknown, fallback = '—'): string => {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value as string | number | boolean)
}

const strOrUndefined = (value: unknown): string | undefined => {
  const text = str(value, '')
  return text === '' ? undefined : text
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

async function checkScope(client: BitrixClient, rows: Row[]): Promise<void> {
  try {
    const scopes = await call<string[]>(client, 'scope')
    const list = Array.isArray(scopes) ? scopes.map(String) : []
    const missing = ['imbot', 'imopenlines'].filter(
      item => !list.includes(item),
    )

    rows.push({
      checagem: '1. escopos imbot + imopenlines',
      status: missing.length ? 'FALHA' : 'OK',
      detalhe: missing.length
        ? `faltando: ${missing.join(', ')} — exige manifest + reinstalação`
        : list.join(', '),
    })
  } catch (err) {
    rows.push({
      checagem: '1. escopos imbot + imopenlines',
      status: 'FALHA',
      detalhe: errorMessage(err),
    })
  }
}

type BotSummary = {
  id: number
  eventMode?: string
  webhookUrl?: string
  /**
   * `CLIENT_ID` de `transfer`/`finish`. **Nosso**, não do Bitrix: a doc do
   * `Bot.register` diz para passar um token único, e a resposta não o devolve. Aqui o
   * spike usa um fixo para o estágio de handoff poder rodar sem estado.
   */
  botToken?: string
}

async function findBot(client: BitrixClient): Promise<BotSummary | null> {
  const result = asRecord(await call(client, 'imbot.v2.Bot.list'))
  const bots = Array.isArray(result.bots) ? result.bots : []

  for (const raw of bots) {
    const bot = asRecord(raw)
    if (str(bot.code, '') === BOT_CODE) {
      return {
        id: Number(bot.id),
        eventMode: strOrUndefined(bot.eventMode),
        webhookUrl: strOrUndefined(bot.webhookUrl),
        // `Bot.list` não devolve o token — quem registrou é que sabe. Ver `SPIKE_BOT_TOKEN`.
        botToken: undefined,
      }
    }
  }

  return null
}

async function ensureBot(
  client: BitrixClient,
  webhookUrl: string,
  rows: Row[],
): Promise<number | null> {
  const existing = await findBot(client)
  if (existing) {
    rows.push({
      checagem: '2a. bot de canal aberto registrado',
      status: 'OK',
      detalhe: `reaproveitado id=${existing.id} eventMode=${existing.eventMode ?? '—'} webhook=${existing.webhookUrl ?? '—'}`,
    })
    return existing.id
  }

  try {
    const response = asRecord(
      await call(client, 'imbot.v2.Bot.register', {
        fields: {
          code: BOT_CODE,
          botToken: SPIKE_BOT_TOKEN,
          type: 'openline',
          eventMode: 'webhook',
          webhookUrl,
          properties: {
            name: BOT_NAME,
            workPosition: 'Fluxo de atendimento',
            color: 'GREEN',
          },
        },
      }),
    )

    const bot = asRecord(response.bot)
    const botId = Number(bot.id)
    if (!botId)
      throw new Error(`resposta sem bot.id: ${JSON.stringify(response)}`)

    rows.push({
      checagem: '2a. bot de canal aberto registrado',
      status: 'OK',
      detalhe: `id=${botId} type=openline eventMode=webhook botToken=${SPIKE_BOT_TOKEN}`,
    })
    return botId
  } catch (err) {
    rows.push({
      checagem: '2a. bot de canal aberto registrado',
      status: 'FALHA',
      detalhe: errorMessage(err),
    })
    return null
  }
}

/**
 * Leitura de volta obrigatória: `config.update` responde `true` sem garantir que o
 * campo persistiu. Quem prova o vínculo é o `config.get`.
 */
async function readBackWelcomeBot(
  client: BitrixClient,
  lineId: string,
  expectedBotId: number | null,
  rows: Row[],
): Promise<void> {
  try {
    const config = asRecord(
      await call(client, 'imopenlines.config.get', { CONFIG_ID: lineId }),
    )

    const enabled = str(config.WELCOME_BOT_ENABLE, '')
    const boundId = Number(config.WELCOME_BOT_ID ?? 0)
    const matches =
      enabled === 'Y' && (!expectedBotId || boundId === expectedBotId)

    rows.push({
      checagem: '2b. welcome bot persistiu na linha',
      status: matches ? 'OK' : 'FALHA',
      detalhe: `linha="${str(config.LINE_NAME, '?')}" ENABLE=${enabled || '—'} BOT_ID=${boundId || '—'} JOIN=${str(config.WELCOME_BOT_JOIN)} LEFT=${str(config.WELCOME_BOT_LEFT)} TIME=${str(config.WELCOME_BOT_TIME)}`,
    })

    // Saudação nativa somada ao nó raiz duplica a primeira mensagem para o cliente.
    if (str(config.WELCOME_MESSAGE, '') === 'Y') {
      rows.push({
        checagem: '2c. saudação nativa da linha',
        status: 'INFO',
        detalhe: 'WELCOME_MESSAGE=Y — vai duplicar com o nó raiz do fluxo',
      })
    }
  } catch (err) {
    rows.push({
      checagem: '2b. welcome bot persistiu na linha',
      status: 'FALHA',
      detalhe: errorMessage(err),
    })
  }
}

async function stageLines(client: BitrixClient): Promise<void> {
  const result = await call(client, 'imopenlines.config.list.get')
  const lines = Array.isArray(result) ? result : Object.values(asRecord(result))

  console.log('\nLinhas (canais abertos) do portal:')
  console.table(
    lines.map(raw => {
      const line = asRecord(raw)
      return {
        CONFIG_ID: str(line.ID ?? line.id, '?'),
        nome: str(line.LINE_NAME, '?'),
        ativa: str(line.ACTIVE, '?'),
        welcomeBot: str(line.WELCOME_BOT_ID),
      }
    }),
  )
  console.log('\nEscolha o CONFIG_ID e rode: --stage=setup --line=<CONFIG_ID>')
}

async function stageSetup(
  client: BitrixClient,
  lineId: string,
  webhookUrl: string,
): Promise<void> {
  const rows: Row[] = []

  await checkScope(client, rows)

  if (/ngrok-free\.(app|dev)/i.test(webhookUrl)) {
    rows.push({
      checagem: '0. handler do bot',
      status: 'INFO',
      detalhe: 'ngrok free — prefira cloudflared (docs/DEV-BITRIX.md)',
    })
  }

  const botId = await ensureBot(client, webhookUrl, rows)

  if (botId) {
    try {
      await call(client, 'imopenlines.config.update', {
        CONFIG_ID: lineId,
        PARAMS: {
          WELCOME_BOT_ENABLE: 'Y',
          WELCOME_BOT_ID: botId,
          WELCOME_BOT_JOIN: 'always',
          WELCOME_BOT_LEFT: 'queue',
          // Alto de propósito: o handoff é decisão do fluxo, não timeout do Bitrix.
          WELCOME_BOT_TIME: 3600,
        },
      })
    } catch (err) {
      rows.push({
        checagem: '2b. welcome bot persistiu na linha',
        status: 'FALHA',
        detalhe: `config.update: ${errorMessage(err)}`,
      })
    }

    await readBackWelcomeBot(client, lineId, botId, rows)
  }

  print(rows)
  console.log(`
Checagem 3 — evento chegando (fora do processo):
  1. túnel público apontando para a API; handler do bot = ${webhookUrl}
  2. manda "oi" do celular para essa linha
  3. observa o log de ${webhookUrl}: espera ONIMBOTV2JOINCHAT / ONIMBOTV2MESSAGEADD
     com chat.entityType === 'LINES'
  4. salva o payload cru — é o contrato real (modo webhook manda tudo string) e vira
     fixture dos testes da F2
  5. anota o message.chatId e rode:
     --stage=say --chat=<chatId> --text="1 Confirmar"`)
}

async function stageStatus(
  client: BitrixClient,
  lineId: string | null,
  webhookUrl: string,
): Promise<void> {
  const rows: Row[] = []

  await checkScope(client, rows)

  const bot = await findBot(client)
  rows.push({
    checagem: '2a. bot de canal aberto registrado',
    status: bot ? 'OK' : 'FALHA',
    detalhe: bot
      ? `id=${bot.id} eventMode=${bot.eventMode ?? '—'} webhook=${bot.webhookUrl ?? '—'}`
      : `nenhum bot com code=${BOT_CODE} — rode --stage=setup`,
  })

  if (bot?.webhookUrl && bot.webhookUrl !== webhookUrl) {
    rows.push({
      checagem: '2a1. handler do bot vs env',
      status: 'INFO',
      detalhe: `bot aponta ${bot.webhookUrl}, env aponta ${webhookUrl} — re-registre se o túnel mudou`,
    })
  }

  if (lineId) await readBackWelcomeBot(client, lineId, bot?.id ?? null, rows)

  print(rows)
}

async function stageSay(
  client: BitrixClient,
  chatId: string,
  text: string,
): Promise<void> {
  const rows: Row[] = []
  const sentAt = new Date()

  try {
    const result = await call(client, 'imopenlines.bot.session.message.send', {
      CHAT_ID: chatId,
      NAME: 'DEFAULT',
      MESSAGE: text,
    })

    rows.push({
      checagem: '4. fala do bot aceita na sessão',
      status: 'OK',
      detalhe: `retorno=${JSON.stringify(result)} — o método não confirma criação da mensagem`,
    })
  } catch (err) {
    rows.push({
      checagem: '4. fala do bot aceita na sessão',
      status: 'FALHA',
      detalhe: errorMessage(err),
    })
  }

  print(rows)
  console.log(`
Enviado em ${sentAt.toISOString()} — use este instante para medir a latência.

Confirmação fora do processo (checagens 4 e 5):
  - a mensagem apareceu no celular?  -> plano A fecha no envio
  - o log do worker bitrix-received-message mostra o envio pelo nosso sender, e
    quanto tempo depois deste instante? (alvo: ONIMCONNECTORMESSAGEADD em < 1 s)
  - o texto saiu limpo, sem prefixo de operador humano
    (prepareOpenLineOutboundText)?   -> senão precisa bypass para autor bot
  - conta as chamadas REST da resposta inteira (log do worker): alvo <= 3 com batch`)
}

/**
 * Handoff pelos três alvos que o editor oferece.
 *
 * `bot.session.transfer`, não `bot.session.operator`: o primeiro serve aos três alvos
 * (fila, atendente, outro canal) com o mesmo método, e o segundo só manda para a fila.
 *
 * Usa o `transferParams` de produção de propósito — copiar os parâmetros aqui validaria
 * a cópia, não o que o worker vai chamar. O alvo é escolhido pelos argumentos:
 *
 *   --stage=handoff --chat=112                  → fila da própria linha
 *   --stage=handoff --chat=112 --user=15        → atendente 15
 *   --stage=handoff --chat=112 --queue=7        → canal aberto 7 (CONFIG_ID)
 *
 * `--queue` é o que precisa de confirmação contra portal: a doc de `bot.session.transfer`
 * lista `QUEUE_ID` sem explicar de onde vem, e é a doc de `imopenlines.operator.transfer`
 * que diz ser o `ID` de `config.list.get`. Se este estágio falhar com `--queue`, o alvo
 * `line` do editor precisa de outro método — o resto do handoff não muda.
 */
async function stageHandoff(
  client: BitrixClient,
  chatId: string,
  userId: string | null,
  queueId: string | null,
  tokenArg: string | null,
): Promise<void> {
  const rows: Row[] = []

  if (userId && queueId) {
    console.error('--user e --queue são alvos diferentes: passe só um')
    process.exit(1)
  }

  /**
   * `CLIENT_ID` obrigatório: o bot é `eventMode: 'webhook'`. Vem do `SPIKE_BOT_TOKEN`
   * usado no `--stage=setup`; `--token=` cobre bot registrado fora deste script.
   */
  const botToken = tokenArg ?? SPIKE_BOT_TOKEN

  rows.push({
    checagem: '6. CLIENT_ID (botToken)',
    status: 'INFO',
    detalhe: `origem=${tokenArg ? '--token' : 'SPIKE_BOT_TOKEN'}`,
  })

  const target: HandoffTarget = userId
    ? { type: 'evenly', bitrixUserIds: [userId] }
    : queueId
      ? { type: 'line', lineId: queueId }
      : { type: 'queue' }

  const params = transferParams(chatId, target, botToken)

  rows.push({
    checagem: `6. alvo: ${target.type}`,
    status: 'INFO',
    detalhe: `params=${JSON.stringify(params)}`,
  })

  try {
    const result = await call(
      client,
      'imopenlines.bot.session.transfer',
      params,
    )
    rows.push({
      checagem: `6. transfer aceito (${target.type})`,
      status: 'OK',
      detalhe: `retorno=${JSON.stringify(result)} — `.concat(
        'o método devolve `true` sem confirmar quem recebeu',
      ),
    })
  } catch (err) {
    rows.push({
      checagem: `6. transfer aceito (${target.type})`,
      status: 'FALHA',
      detalhe: errorMessage(err),
    })
  }

  print(rows)
  console.log(`
Confirmação fora do processo (checagem 6):
  - quem recebeu a sessão? ${
    target.type === 'queue'
      ? 'um operador da fila desta linha'
      : target.type === 'evenly'
        ? `o usuário ${userId} especificamente — não outro da fila`
        : `um operador do canal aberto ${queueId} — não da linha original`
  }
  - o receptor vê o fluxo do bot no histórico do chat?
    Se não vê, a vantagem principal do plano A cai e vale reavaliar o plano B.
  - o bot saiu do chat (LEAVE=Y)? Se ficou, mensagem nova do cliente ainda chega
    ao nosso webhook e o fluxo reiniciaria por cima do atendimento humano.
  - erro TRANSFER_ID_EMPTY com --queue significa que QUEUE_ID não é aceito aqui:
    o alvo \`line\` do editor precisa de imopenlines.operator.transfer.`)
}

async function stageCleanup(
  client: BitrixClient,
  lineId: string | null,
): Promise<void> {
  const rows: Row[] = []

  if (lineId) {
    try {
      await call(client, 'imopenlines.config.update', {
        CONFIG_ID: lineId,
        PARAMS: { WELCOME_BOT_ENABLE: 'N' },
      })
      rows.push({
        checagem: 'cleanup: welcome bot desligado',
        status: 'OK',
        detalhe: `linha ${lineId}`,
      })
    } catch (err) {
      rows.push({
        checagem: 'cleanup: welcome bot desligado',
        status: 'FALHA',
        detalhe: errorMessage(err),
      })
    }
  }

  const bot = await findBot(client)
  if (!bot) {
    rows.push({
      checagem: 'cleanup: bot removido',
      status: 'OK',
      detalhe: `nenhum bot com code=${BOT_CODE}`,
    })
  } else {
    try {
      await call(client, 'imbot.v2.Bot.unregister', { botId: bot.id })
      rows.push({
        checagem: 'cleanup: bot removido',
        status: 'OK',
        detalhe: `id=${bot.id}`,
      })
    } catch (err) {
      rows.push({
        checagem: 'cleanup: bot removido',
        status: 'FALHA',
        detalhe: `${errorMessage(err)} — remova manualmente (id=${bot.id})`,
      })
    }
  }

  print(rows)
}

function print(rows: Row[]): void {
  console.table(rows)

  if (stats.length > 0) {
    console.log('\nConsumo de request deste estágio:')
    console.table(stats)
    const operating = stats.at(-1)?.operating
    if (operating != null) {
      console.log(
        `operating acumulado no último método: ${operating.toFixed(2)}s (teto do cloud ~480s)`,
      )
    }
  }

  if (rows.some(row => row.status === 'FALHA')) {
    console.log(
      '\nHouve FALHA — leia o detalhe antes de seguir para o próximo estágio.',
    )
  }
}

async function main(): Promise<void> {
  const { domain, stage, line, chat, text, user, queue, token, webhook } =
    parseArgs(process.argv.slice(2))

  if (!domain || !STAGES.includes(stage)) {
    console.error(
      `Uso: yarn spike:flow-bot --domain=portal.bitrix24.com.br --stage=${STAGES.join('|')} [--line=ID] [--chat=ID] [--text="..."] [--user=ID] [--queue=CONFIG_ID] [--token=BOT_TOKEN] [--webhook=URL]`,
    )
    process.exit(1)
  }

  if (!webhook) {
    console.error(
      'Sem handler para o bot: configure BITRIX_WEBHOOK_URL ou passe --webhook=',
    )
    process.exit(1)
  }

  const client = await resolveClient(domain)

  switch (stage) {
    case 'lines':
      return stageLines(client)

    case 'setup':
      if (!line) {
        console.error(
          '--line=<CONFIG_ID> obrigatório (descubra com --stage=lines)',
        )
        process.exit(1)
      }
      return stageSetup(client, line, webhook)

    case 'status':
      return stageStatus(client, line, webhook)

    case 'say':
      if (!chat || !text) {
        console.error('--chat=<CHAT_ID> e --text="..." obrigatórios')
        process.exit(1)
      }
      return stageSay(client, chat, text)

    case 'handoff':
      if (!chat) {
        console.error('--chat=<CHAT_ID> obrigatório')
        process.exit(1)
      }
      return stageHandoff(client, chat, user, queue, token)

    case 'cleanup':
      return stageCleanup(client, line)
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
