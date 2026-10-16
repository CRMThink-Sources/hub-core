import { randomBytes } from 'node:crypto'
import { env } from '@/config/env'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type {
  BotFlowBot,
  GetBotFlowBotRepository,
  SaveBotFlowBotRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-bot.repository'
import { thinkzapError } from '../errors/catalog'
import { missingBotScopes } from './check-bot-scopes'

const log = createWorkerSourceLogger('bitrix')

// Não confundir com o `thinkzap-connector` de `ensureBitrixBotId`: aquele é
// `type: supervisor` / `eventMode: fetch` e não recebe evento. Este participa da conversa.
//
// Do env: o `code` é único no portal, não por app — ver `bitrix.botFlowCode`. O evento que
// chega é casado por este mesmo prefixo, então trocá-lo troca as duas pontas de uma vez.
export const BOT_CODE = env.bitrix.botFlowCode
const BOT_NAME_FALLBACK = 'ThinkBot'

/** Um `code` por fluxo: `register` é idempotente por `code` e devolveria o bot de outro. */
export function flowBotCode(flowId: string): string {
  return `${BOT_CODE}-${flowId.slice(0, 8)}`
}

/** `BOT_CODE` puro é o dos bots registrados antes de haver um bot por fluxo. */
export function isFlowBotCode(code: string): boolean {
  return code === BOT_CODE || code.startsWith(`${BOT_CODE}-`)
}

/**
 * Nome do bot como o cliente o vê na configuração do canal aberto.
 *
 * O prefixo identifica o app entre os outros bots do portal; o sufixo é o nome que o
 * cliente deu ao fluxo.
 */
export function botDisplayName(flowName?: string): string {
  const nome = flowName?.trim()
  return nome ? `[ThinkBot] ${nome}` : BOT_NAME_FALLBACK
}

type BotResponse = {
  result?: { bot?: { id?: number | string } }
}

// O `botToken` é entrada do `Bot.register`, não saída: a resposta do registro não traz o
// campo, então quem gera e guarda somos nós.
function novoBotToken(): string {
  return randomBytes(32).toString('hex')
}

// Chamado no vínculo e não na criação do fluxo: `Bot.register` exige o escopo `imbot`, e
// aqui a recusa é localizada.
export async function ensureBotFlowBot(
  client: BitrixClient,
  repos: { get: GetBotFlowBotRepository; save: SaveBotFlowBotRepository },
  input: {
    appId: string
    flowId: string
    webhookUrl: string
    flowName?: string
  },
): Promise<BotFlowBot> {
  const existing = await repos.get.getByFlowId(input.appId, input.flowId)

  if (existing) {
    const webhookMudou = existing.webhookUrl !== input.webhookUrl

    /**
     * Um `Bot.update` cobre as duas coisas.
     *
     * Webhook: mudou de endereço (deploy em outro domínio, túnel novo em dev) e sem isto
     * o portal segue batendo no antigo — nenhum evento chega.
     *
     * Nome: reenviado sempre que há `flowName`, porque não guardamos o nome atual e o
     * cliente pode ter renomeado o fluxo. Vincular é ação rara; uma chamada a mais aqui
     * sai mais barato que uma coluna que só serviria de cache.
     */
    if (webhookMudou || input.flowName) {
      await client.callMethod('imbot.v2.Bot.update', {
        botId: existing.bitrixBotId,
        // O mesmo `botToken` de sempre: trocá-lo invalidaria as chamadas seguintes.
        botToken: existing.botToken,
        fields: {
          ...(webhookMudou ? { webhookUrl: input.webhookUrl } : {}),
          ...(input.flowName
            ? { properties: { name: botDisplayName(input.flowName) } }
            : {}),
        },
      })

      log.info(
        {
          appId: input.appId,
          flowId: input.flowId,
          bitrixBotId: existing.bitrixBotId,
          webhookMudou,
        },
        'Bot do fluxo atualizado',
      )

      return webhookMudou
        ? repos.save.save({
            ...existing,
            flowId: input.flowId,
            webhookUrl: input.webhookUrl,
          })
        : existing
    }

    return existing
  }

  // Só no registro: bot que já existe prova que o escopo estava lá, e a checagem custaria
  // uma chamada em cada vínculo para não descobrir nada.
  const faltando = await missingBotScopes(client)
  if (faltando.length) {
    log.error(
      { appId: input.appId, faltando },
      'App do portal sem os escopos do bot',
    )
    throw thinkzapError(
      'thinkzap.bot.scope_missing',
      new Error(`escopos ausentes: ${faltando.join(', ')}`),
    )
  }

  const botToken = novoBotToken()

  // `Bot.register` é idempotente por `code` e não atualiza nada em chamada repetida: um
  // registro anterior que não foi gravado aqui volta com o token antigo, e o novo
  // `botToken` não vale. Daí a gravação na mesma request.
  const response = await registrar(client, {
    code: flowBotCode(input.flowId),
    botToken,
    webhookUrl: input.webhookUrl,
    flowName: input.flowName,
    appId: input.appId,
  })

  const bitrixBotId = Number(response.result?.bot?.id ?? 0)

  if (!bitrixBotId) {
    log.error(
      { appId: input.appId, response: JSON.stringify(response) },
      'imbot.v2.Bot.register sem bot.id',
    )
    throw thinkzapError('thinkzap.bot.register_failed')
  }

  log.info(
    { appId: input.appId, flowId: input.flowId, bitrixBotId },
    'Bot do fluxo registrado',
  )

  return repos.save.save({
    appId: input.appId,
    flowId: input.flowId,
    bitrixBotId,
    botToken,
    webhookUrl: input.webhookUrl,
  })
}

/**
 * Registra o bot, nomeando a recusa por `code` ocupado.
 *
 * O Bitrix devolve `BOT_CODE_ALREADY_TAKEN` em HTTP 400, e o `BitrixError` resultante
 * chegava à tela como "Não foi possível vincular" — sem dizer que o conflito é de nome
 * entre instalações nem o que fazer a respeito.
 */
async function registrar(
  client: BitrixClient,
  input: {
    code: string
    botToken: string
    webhookUrl: string
    flowName?: string
    appId: string
  },
): Promise<BotResponse> {
  try {
    return await client.callMethod<BotResponse>('imbot.v2.Bot.register', {
      fields: {
        code: input.code,
        botToken: input.botToken,
        type: 'openline',
        eventMode: 'webhook',
        webhookUrl: input.webhookUrl,
        properties: {
          name: botDisplayName(input.flowName),
          workPosition: 'Atendimento automático',
          color: 'GREEN',
        },
      },
    })
  } catch (err) {
    if (!codeJaUsado(err)) throw err

    log.error(
      { appId: input.appId, code: input.code },
      'Code do bot já registrado por outra instalação no portal',
    )
    throw thinkzapError('thinkzap.bot.code_taken', toError(err))
  }
}

/** Pela mensagem porque `callMethod` embala a resposta do Bitrix em `BitrixError`. */
function codeJaUsado(err: unknown): boolean {
  return err instanceof Error && err.message.includes('BOT_CODE_ALREADY_TAKEN')
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}
