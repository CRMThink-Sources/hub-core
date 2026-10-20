import { env } from '@/config/env'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  bindWelcomeBot,
  unbindWelcomeBot,
} from '@/modules/thinkzap/application/bind-welcome-bot'
import { ensureBotFlowBot } from '@/modules/thinkzap/application/ensure-bot-flow-bot'
import type {
  DeleteBotFlowBotRepository,
  GetBotFlowBotRepository,
  ListBotFlowBotsRepository,
  SaveBotFlowBotRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-bot.repository'
import type { ListBotFlowBindingsRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { WelcomeBotPort } from '@/modules/thinkzap/presentation/controllers/bot-flow/bot-flow-binding.controllers'
import { logThinkzapError, thinkzapError } from '../../errors/catalog'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')

export class BitrixWelcomeBotAdapter implements WelcomeBotPort {
  constructor(
    private readonly client: BitrixClient,
    private readonly repos: {
      get: GetBotFlowBotRepository
      list: ListBotFlowBotsRepository
      save: SaveBotFlowBotRepository
      delete: DeleteBotFlowBotRepository
      bindings: ListBotFlowBindingsRepository
    },
  ) {}

  async ensureBot(
    appId: string,
    flowId: string,
    flowName?: string,
  ): Promise<{ bitrixBotId: number }> {
    const webhookUrl = env.bitrix.botWebhookUrl

    // Sem handler o bot é registrado e nunca recebe evento: recusar aqui evita vincular
    // uma linha para nada.
    if (!webhookUrl) {
      throw thinkzapError('thinkzap.config.missing_env')
    }

    const bot = await ensureBotFlowBot(this.client, this.repos, {
      appId,
      flowId,
      webhookUrl,
      flowName,
    })

    return { bitrixBotId: bot.bitrixBotId }
  }

  async bindLine(input: {
    appId: string
    lineId: string
    bitrixBotId: number
  }): Promise<void> {
    const nossos = await this.repos.list.listByAppId(input.appId)

    return bindWelcomeBot(this.client, {
      lineId: input.lineId,
      bitrixBotId: input.bitrixBotId,
      ownBotIds: nossos.map(bot => bot.bitrixBotId),
    })
  }

  unbindLine(input: { lineId: string }): Promise<void> {
    return unbindWelcomeBot(this.client, input)
  }

  async removeBotIfUnused(appId: string, flowId: string): Promise<void> {
    const restantes = await this.repos.bindings.listByAppId(appId)
    if (restantes.some(binding => binding.flowId === flowId)) return

    await this.removeBot(appId, flowId)
  }

  // Portal antes do banco, e só com sucesso confirmado: nosso registro é a única cópia do
  // `botToken` (`imbot.v2.Bot.list` não o devolve), então apagar a row com o bot ainda no
  // portal o tornaria inalcançável para sempre.
  //
  // Falha não sobe: as linhas já foram desligadas; sobra um bot sem uso, que o próximo
  // vínculo do fluxo reaproveita.
  async removeBot(appId: string, flowId: string): Promise<void> {
    const bot = await this.repos.get.getByFlowId(appId, flowId)
    if (!bot) return

    try {
      const response = await this.client.callMethod<UnregisterResponse>(
        'imbot.v2.Bot.unregister',
        { botId: bot.bitrixBotId, botToken: bot.botToken },
      )

      // `unregister` não lança quando recusa: sem esta checagem, um `false` apagaria o
      // token de um bot que continua registrado.
      if (!unregistered(response)) {
        logThinkzapError(
          log,
          'thinkzap.bot.unregister_failed',
          {
            appId,
            flowId,
            bitrixBotId: bot.bitrixBotId,
            resposta: JSON.stringify(response),
          },
          { level: 'warn' },
        )
        return
      }

      await this.repos.delete.delete(appId, bot.bitrixBotId)

      log.info(
        { appId, flowId, bitrixBotId: bot.bitrixBotId },
        'Bot do fluxo removido do portal: nenhuma linha usa mais',
      )
    } catch (err) {
      logThinkzapError(
        log,
        'thinkzap.bot.unregister_failed',
        { appId, flowId, bitrixBotId: bot.bitrixBotId, err },
        { level: 'warn' },
      )
    }
  }
}

type UnregisterResponse = { result?: boolean | { result?: boolean } }

// A doc mostra `{ result: { result: true } }` mas descreve `result` como boolean; as duas
// formas aparecem, conforme a versão do portal.
function unregistered(response: UnregisterResponse): boolean {
  const result = response?.result

  if (typeof result === 'boolean') return result
  if (result && typeof result === 'object') return result.result === true

  return false
}
