import { randomBytes } from 'node:crypto'
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
export const BOT_CODE = 'thinkzap-flow'
const BOT_NAME_FALLBACK = 'ThinkBot'

/**
 * Nome do bot como o cliente o vê na configuração do canal aberto.
 *
 * O prefixo identifica o app entre os outros bots do portal; o sufixo é o nome que o
 * cliente deu ao fluxo. Um bot e um fluxo por instalação, então não há ambiguidade.
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

// Um bot por instalação (quem escolhe o fluxo é o vínculo por linha), chamado no vínculo e
// não na instalação: `Bot.register` exige o escopo `imbot`, e aqui a recusa é localizada.
export async function ensureBotFlowBot(
  client: BitrixClient,
  repos: { get: GetBotFlowBotRepository; save: SaveBotFlowBotRepository },
  input: { appId: string; webhookUrl: string; flowName?: string },
): Promise<BotFlowBot> {
  const existing = await repos.get.getByAppId(input.appId)

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
          bitrixBotId: existing.bitrixBotId,
          webhookMudou,
        },
        'Bot do fluxo atualizado',
      )

      return webhookMudou
        ? repos.save.save({ ...existing, webhookUrl: input.webhookUrl })
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
  const response = await client.callMethod<BotResponse>(
    'imbot.v2.Bot.register',
    {
      fields: {
        code: BOT_CODE,
        botToken,
        type: 'openline',
        eventMode: 'webhook',
        webhookUrl: input.webhookUrl,
        properties: {
          name: botDisplayName(input.flowName),
          workPosition: 'Atendimento automático',
          color: 'GREEN',
        },
      },
    },
  )

  const bitrixBotId = Number(response.result?.bot?.id ?? 0)

  if (!bitrixBotId) {
    log.error(
      { appId: input.appId, response: JSON.stringify(response) },
      'imbot.v2.Bot.register sem bot.id',
    )
    throw thinkzapError('thinkzap.bot.register_failed')
  }

  log.info({ appId: input.appId, bitrixBotId }, 'Bot do fluxo registrado')

  return repos.save.save({
    appId: input.appId,
    bitrixBotId,
    botToken,
    webhookUrl: input.webhookUrl,
  })
}
