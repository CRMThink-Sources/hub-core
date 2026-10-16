import { adoptLineBinding } from '@/modules/thinkzap/application/adopt-line-binding'
import { isFlowBotCode } from '@/modules/thinkzap/application/ensure-bot-flow-bot'
import { runBotTurn } from '@/modules/thinkzap/application/run-bot-turn'
import { parseBotEvent } from '@/modules/thinkzap/domain/bot-flow/bot-event'
import {
  contactNameFromDialog,
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

  // `MESSAGEADD` e `JOINCHAT` chegam juntos e duplicariam a saudação: um turno por chat,
  // concorrente descartado (esperar prenderia slots do worker).
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
      lineId,
      chatId: event.chatId,
      appendJobLog: ctx.appendJobLog,
    })

    const deps = {
      session: sessao,
      sessions,
      flows,
      bindings,
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

    // Canal ligado pelo painel do Bitrix: adota só em `sem-vinculo`; os outros skips são
    // decisão do cliente (vínculo inativo, fluxo fora do ar).
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
      // Bot na linha sem fluxo: vai para a fila em vez de deixar o chat mudo.
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
          msg: `Turno sem fluxo (${outcome.reason}) — entregando para a fila`,
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

// A fala do bot não dispara `ONIMCONNECTORMESSAGEADD`, então entregamos ao contato direto;
// canal sem conector ThinkZap fica só no eco (o Bitrix repassa ao conector dele).
async function comEntregaAoContato(
  eco: BotSessionPort,
  input: {
    domain: string
    lineId: string
    chatId: string
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

  const contato = makeOutboundSenderResolver().resolve(
    context.connector.provider,
    {
      instanceId: context.instance.instanceId,
      zApiToken: context.instance.zApiToken,
      channelId: context.instance.channelId,
      chatId: input.chatId,
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
