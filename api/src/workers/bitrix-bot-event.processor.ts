import { EnqueueBotSpeech } from '@/modules/thinkzap/application/enqueue-bot-speech'
import { isUnifiedOutboxEnabled } from '@/modules/thinkzap/application/helpers/unified-outbox'
import { QueuedBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/queued-bot-session.adapter'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { BullMqWidgetSendQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import { makeSendCadence } from '@/modules/thinkzap/main/make-send-cadence'
import { adoptLineBinding } from '@/modules/thinkzap/application/adopt-line-binding'
import { CheckThinkbotConnector } from '@/modules/thinkzap/application/check-thinkbot-connector'
import { isFlowBotCode } from '@/modules/thinkzap/application/ensure-bot-flow-bot'
import { runBotTurn } from '@/modules/thinkzap/application/run-bot-turn'
import { parseBotEvent } from '@/modules/thinkzap/domain/bot-flow/bot-event'
import {
  contactNameFromDialog,
  connectorChatIdFromDialog,
  openLineIdFromDialog,
} from '@/modules/thinkzap/domain/bot-flow/open-line-entity-id'
import {
  crmEntitiesFromDialog,
  crmVars,
} from '@/modules/thinkzap/domain/bot-flow/crm-entities'
import { isWithinWorkingHours } from '@/modules/thinkzap/domain/bot-flow/working-hours'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { BitrixBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-bot-session.adapter'
import { HybridBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/hybrid-bot-session.adapter'
import { makeBitrixWebhookContextRepository } from '@/modules/thinkzap/main/make-bitrix-webhook-context-repository'
import { makeOutboundSenderResolver } from '@/modules/thinkzap/main/make-outbound-sender-resolver'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { findLineItemByInstanceId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import {
  dailyLimitPolicyOf,
  sendWithinDailyQuota,
} from '@/modules/thinkzap/application/helpers/send-within-daily-quota'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { OutboundMessageSender } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import type { BitrixWebhookContext } from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { resolveByMarketplaceCode } from '@/shared/app-catalog/app-catalog'
import { env } from '@/config/env'
import type { BotSessionPort } from '@/modules/thinkzap/domain/ports/bot-session.port'
import { PrismaBotFlowBindingRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow-binding.repository'
import { PrismaBotFlowBotRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow-bot.repository'
import { PrismaBotFlowRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow.repository'
import { PrismaBotSessionRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-session.repository'
import { acquireBotChatLock } from '@/modules/thinkzap/infra/queue/bot-chat-lock'
import { redisConnection } from '@/queue/redis-connection'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'

const log = createWorkerSourceLogger('bitrix')

const sessions = new PrismaBotSessionRepository()
const flows = new PrismaBotFlowRepository()
const bindings = new PrismaBotFlowBindingRepository()
const bots = new PrismaBotFlowBotRepository()
const enqueueBotSpeech = new EnqueueBotSpeech({
  outbox: new PrismaWidgetOutboxRepository(),
  sendQueue: new BullMqWidgetSendQueue(),
  cadence: makeSendCadence(),
})

export async function processBitrixBotEvent(
  body: unknown,
  ctx: { appendJobLog: AppendJobLog },
): Promise<void> {
  const event = parseBotEvent(body, isFlowBotCode)

  if (event.kind === 'ignore') {
    // Caminho normal: operador, sistema e outros bots chegam no mesmo endereço.
    await ctx.appendJobLog(`Evento ignorado | motivo=${event.ignoreReason}`)
    return
  }

  if (!event.domain) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      { chatId: event.chatId, kind: event.kind },
      {
        level: 'warn',
        msg: 'Evento do bot sem domínio — sem como resolver a instalação',
      },
    )
    return
  }

  const domain = await new PrismaDomainRepository().getDomain(event.domain)
  if (!domain) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      { domain: event.domain, chatId: event.chatId },
      {
        level: 'warn',
        msg: 'Domínio do evento não corresponde a nenhuma instalação',
      },
    )
    return
  }

  const installedApp =
    await new PrismaInstalledAppRepository().getByAppCodeAndDomainId(
      thinkzapAppCodeId(),
      domain.id,
    )
  if (!installedApp) {
    logThinkzapError(
      log,
      'thinkzap.app.not_found',
      { domain: event.domain, domainId: domain.id },
      { level: 'error' },
    )
    return
  }

  const credential = await new PrismaCredentialRepository().get({
    appId: installedApp.id,
  })
  if (!credential) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      { appId: installedApp.id },
      {
        level: 'error',
        msg: 'Instalação sem credencial — não é possível responder',
      },
    )
    return
  }

  // `botToken` vem do banco (única cópia); sem ele `transfer`/`finish` não identificam o bot.
  const bot = await bots.getByBitrixBotId(installedApp.id, event.bitrixBotId)
  if (!bot) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      {
        appId: installedApp.id,
        chatId: event.chatId,
        bitrixBotId: event.bitrixBotId,
      },
      {
        level: 'error',
        msg: 'Evento de bot sem registro nosso — o bot existe no portal e não no banco',
      },
    )
    return
  }

  const client = new BitrixClient({
    bitrixCredential: credential,
    domain: domain.name,
  })

  // Um turno por chat; concorrente descartado (esperar prenderia slots do worker).
  const lock = await acquireBotChatLock(
    redisConnection,
    installedApp.id,
    event.chatId,
  )
  if (!lock) {
    await ctx.appendJobLog(
      `Turno concorrente no mesmo chat (${event.chatId}) — evento descartado.`,
    )
    return
  }

  try {
    // Única ponte entre `chat.id` do evento e o `CONFIG_ID` da linha.
    const dialog = await client.callMethod('imopenlines.dialog.get', {
      CHAT_ID: event.chatId,
    })

    const lineId = openLineIdFromDialog(dialog)
    if (!lineId) {
      logThinkzapError(
        log,
        'thinkzap.bot.event_unresolved',
        { chatId: event.chatId, appId: installedApp.id },
        {
          level: 'warn',
          msg: 'Chat sem linha de canal aberto — dialog.get não devolveu entity_id de LINES',
        },
      )
      return
    }

    await ctx.appendJobLog(
      `Turno do bot | chat=${event.chatId} | linha=${lineId} | tipo=${event.kind}`,
    )

    // Nome do chat como reserva: o `JOINCHAT` (turno da saudação) não traz o autor.
    const crm = crmVars(crmEntitiesFromDialog(dialog), {
      name: event.authorName || contactNameFromDialog(dialog),
    })

    const eco = new BitrixBotSessionAdapter(
      client,
      bot.botToken,
      bot.bitrixBotId,
    )

    const sessao = await comEntregaAoContato(eco, {
      domain: domain.name,
      domainId: domain.id,
      memberId: domain.memberId,
      lineId,
      chatId: event.chatId,
      connectorChatId: connectorChatIdFromDialog(dialog),
      appId: installedApp.id,
      bitrixBotId: bot.bitrixBotId,
      appendJobLog: ctx.appendJobLog,
    })

    const deps = {
      session: sessao,
      sessions,
      flows,
      bindings,
      // Uma leitura por turno: o resumo da transferência sai no idioma da instalação.
      locale: await makeInstallationLocaleRepository().byAppId(installedApp.id),
      connectorAtivo: () =>
        new CheckThinkbotConnector(makeGetAplicationContext()).execute({
          domainId: domain.id,
          appCode: thinkzapAppCodeId(),
        }),
      workingHours: async (id: string) => {
        try {
          const config = await client.getOpenChannel(id)
          const dentro = isWithinWorkingHours(config)

          await ctx.appendJobLog(
            `Horário do canal | linha=${id} | dentro=${dentro} | ` +
              `enable=${config.WORKTIME_ENABLE} ${config.WORKTIME_FROM}-${config.WORKTIME_TO} ` +
              `tz=${config.WORKTIME_TIMEZONE} folga=[${(config.WORKTIME_DAYOFF ?? []).join(',')}]`,
          )

          return dentro
        } catch (error) {
          await ctx.appendJobLog(
            `Horário do canal indisponível | linha=${id} — fluxo segue como dentro do expediente.`,
          )
          logThinkzapError(log, 'thinkzap.bot.working_hours_unavailable', {
            domain: domain.name,
            chatId: event.chatId,
            lineId: id,
            appId: installedApp.id,
            err: error,
          })
          return null
        }
      },
    }

    let outcome = await runBotTurn(event, lineId, installedApp.id, deps, crm)

    // Bot ligado pelo painel do Bitrix: adota só em `sem-vinculo`.
    if (outcome.kind === 'skipped' && outcome.reason === 'sem-vinculo') {
      const adotado = await adoptLineBinding(
        installedApp.id,
        lineId,
        bot.flowId,
        {
          flows,
          bindings,
        },
      )

      if (adotado) {
        await ctx.appendJobLog(
          `Canal adotado | linha=${lineId} | fluxo=${adotado.flowId} — ` +
            'bot configurado pelo painel do Bitrix ganhou vínculo.',
        )
        outcome = await runBotTurn(event, lineId, installedApp.id, deps, crm)
      }
    }

    if (outcome.kind === 'duplicado') {
      // Rede de segurança para evento que chega depois de o lock ser liberado.
      await ctx.appendJobLog(`Evento repetido | motivo=${outcome.reason}`)
      return
    }

    if (outcome.kind === 'entregue') {
      // Antes do `skipped`: transferir para a fila tiraria a conversa do atendente.
      await ctx.appendJobLog(
        `Chat com atendimento humano desde ${outcome.desde.toISOString()} — bot calado.`,
      )
      return
    }

    if (outcome.kind === 'gone') {
      // Sem handoff: o bot saiu do chat, transferir falharia pelo mesmo motivo.
      await ctx.appendJobLog(`Bot fora da sessão | código=${outcome.code}`)
      return
    }

    if (outcome.kind === 'skipped') {
      // Fila em vez de chat mudo.
      logThinkzapError(
        log,
        'thinkzap.bot.turn_skipped',
        {
          chatId: event.chatId,
          lineId,
          appId: installedApp.id,
          reason: outcome.reason,
        },
        {
          level: 'warn',
          msg: `Turno não executado (${outcome.reason}) — entregando para a fila`,
        },
      )

      await ctx.appendJobLog(`Sem fluxo | motivo=${outcome.reason} | fila`)
      await sessao.handoff(event.chatId, { type: 'queue' })
      return
    }

    await ctx.appendJobLog(
      `Turno concluído | efeitos=${outcome.effects.length}`,
    )
  } finally {
    await lock.release()
  }
}

// Fala do bot não dispara `ONIMCONNECTORMESSAGEADD`: entrega direto ao contato.
// Canal de outro conector fica só no eco.
export async function comEntregaAoContato(
  eco: BotSessionPort,
  input: {
    domain: string
    domainId: string
    memberId: string
    lineId: string
    /** Chat do Bitrix: é onde o eco e as operações de sessão acontecem. */
    chatId: string
    /**
     * Chat do conector (telefone/LID do contato), lido do `entity_id` do diálogo. É
     * o destino da fala no WhatsApp — o chat do Bitrix não é um telefone.
     */
    connectorChatId: string | null
    appId: string
    bitrixBotId: number
    appendJobLog: AppendJobLog
  },
): Promise<BotSessionPort> {
  const appCode = resolveByMarketplaceCode(env.appCodes.thinkzap)?.appCodeId

  if (!appCode) return eco

  const context = await makeBitrixWebhookContextRepository().getContext({
    domainName: input.domain,
    appCode,
    line: input.lineId,
  })

  if (!context) {
    await input.appendJobLog(
      `Canal sem conector ThinkZap (linha=${input.lineId}) — fala entregue só pelo chat ` +
        'do canal aberto, que é quem repassa ao conector daquele canal.',
    )
    return eco
  }

  if (!input.connectorChatId) {
    await input.appendJobLog(
      'Diálogo sem o chat do conector no entity_id — sem destino no WhatsApp, a fala ' +
        'fica só no chat do canal aberto.',
    )
    return eco
  }

  /**
   * Caminho unificado (linha Z-API, instalação com a flag): a fala entra na fila de
   * saída da linha e passa pela cadência; o eco sai depois da entrega.
   */
  if (
    context.connector.provider === ConnectorProvider.ZAPI &&
    isUnifiedOutboxEnabled(input.memberId)
  ) {
    const line = await findLineItemByInstanceId(
      {
        instanceId: context.instance.instanceId,
        domainId: context.id,
        appCode,
      },
      makeGetAplicationContext(),
    )
    if (line) {
      const connectorChatId = input.connectorChatId
      await input.appendJobLog(
        `Fala pela fila de saída da linha | instância=${context.instance.instanceId}`,
      )
      return new QueuedBotSessionAdapter(eco, (chatId, text) =>
        enqueueBotSpeech.execute({
          item: line.item,
          instanceDbId: context.instance.id,
          domainId: input.domainId,
          appCode,
          connectorChatId,
          bitrixChatId: chatId,
          text,
          context: { appId: input.appId, bitrixBotId: input.bitrixBotId },
        }),
      )
    }
  }

  const contato = makeOutboundSenderResolver().resolve(
    context.connector.provider,
    {
      instanceId: context.instance.instanceId,
      zApiToken: context.instance.zApiToken,
      channelId: context.instance.channelId,
      chatId: input.connectorChatId,
    },
  )

  await input.appendJobLog(
    `Entrega ao contato por ${context.connector.provider} | ` +
      `instância=${context.instance.instanceId}`,
  )

  return new HybridBotSessionAdapter(
    eco,
    await comCotaDiaria(contato, context, appCode),
    () =>
      input.appendJobLog(
        'Fala do bot NÃO entregue: a linha atingiu o limite diário de mensagens. ' +
          'Provider não foi chamado, eco no chat suprimido, turno segue sem retentativa.',
      ),
  )
}

/**
 * A fala do bot conta no limite diário como qualquer outra saída da linha. Settings
 * do item pelo contexto da aplicação — os do contexto do webhook são congelados.
 * Linha não resolvida continua contada, mas sem limite: não há configuração para aplicar.
 */
async function comCotaDiaria(
  contato: OutboundMessageSender,
  context: BitrixWebhookContext,
  appCode: string,
): Promise<OutboundMessageSender> {
  // Só a linha não oficial tem limite diário.
  if (context.connector.provider !== ConnectorProvider.ZAPI) {
    return contato
  }

  const lineKey = context.instance.instanceId
  const line = await findLineItemByInstanceId(
    { instanceId: lineKey, domainId: context.id, appCode },
    makeGetAplicationContext(),
  )
  const policy = dailyLimitPolicyOf({
    provider: ConnectorProvider.ZAPI,
    lineKey,
    settings: line?.settings,
  })
  const quota = makeDailySendQuota()

  return {
    supportsReply: contato.supportsReply,
    send: (descriptor, options) =>
      sendWithinDailyQuota(quota, policy, () =>
        contato.send(descriptor, options),
      ),
  }
}
