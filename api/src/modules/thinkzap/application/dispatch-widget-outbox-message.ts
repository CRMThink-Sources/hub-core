import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { InteractiveButtonDescriptor } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { InteractiveButtonSenderResolver } from '@/modules/thinkzap/domain/ports/interactive-button-sender-resolver.port'
import { OpenChannelConversationQueue } from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import { OutboundSenderResolver } from '@/modules/thinkzap/domain/ports/outbound-sender-resolver.port'
import { TemplateMessageSenderResolver } from '@/modules/thinkzap/domain/ports/template-sender-resolver.port'
import { classifyProviderSendFailure } from '@/modules/thinkzap/infra/adapters/classify-provider-send-failure'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  AppendJobLog,
  noopJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import { DestinationLock } from '@/modules/thinkzap/infra/queue/destination-send-lock'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import type { SmsMessageStatus } from './report-sms-message-status'
import { WidgetSendOutcome } from './notify-widget-send-outcome'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import {
  dailyLimitPolicyOf,
  isDailyLimitReachedError,
  sendWithinDailyQuota,
} from './helpers/send-within-daily-quota'

export type DispatchLineTarget = {
  provider: ConnectorProvider
  /** `metadata.zApiInstanceId` ou o canal HubMessage. */
  instanceId: string
  zApiToken?: string | null
  channelId?: string | null
  settings?: ConnectorSettings
  /** `core_apps.id`, para resolver o nome do operador. */
  appId?: string
}

export type DispatchOutcome =
  | { status: 'sent'; providerMessageId: string }
  /** Já entregue; só os efeitos colaterais foram retomados. */
  | { status: 'resumed'; providerMessageId: string }
  /** Destino ocupado: o chamador re-agenda sem gastar tentativa. */
  | { status: 'locked' }
  | { status: 'skipped'; reason: 'claimed-by-other' | 'terminal' | 'missing' }
  | { status: 'failed' }
  | { status: 'unknown' }

export type DispatchDeps = {
  outbox: PrismaWidgetOutboxRepository
  senderResolver: OutboundSenderResolver
  templateSenderResolver: TemplateMessageSenderResolver
  interactiveButtonSenderResolver: InteractiveButtonSenderResolver
  messages: PrismaThinkzapMessageRepository
  openChannelQueue: OpenChannelConversationQueue
  acquireLock: (
    instanceId: string,
    destination: string,
  ) => Promise<DestinationLock | null>
  /** Nunca lança. */
  notifyOutcome: (
    outcome: WidgetSendOutcome,
    row: WidgetOutboxRecord,
  ) => Promise<void>
  /** Nunca lança. */
  notifySent: (row: WidgetOutboxRecord) => Promise<void>
  /** Desfecho na tela de campanha. Nunca lança: o envio já deu certo quando roda. */
  reportSmsStatus?: (
    row: WidgetOutboxRecord,
    status: SmsMessageStatus,
  ) => Promise<void>
  /**
   * Cota diária da linha. Ausente, o envio não é contado nem limitado — só os
   * testes que não falam de limite a omitem; o worker sempre injeta.
   */
  quota?: DailySendQuota
  /** Cada chamada é um round-trip ao Redis: registre decisões, não passos. */
  appendJobLog?: AppendJobLog
  /** Ausente, o texto sai cru. */
  prepareOutboundText?: (input: {
    text: string
    settings: ConnectorSettings
    operatorUserId: string
    appId: string
  }) => Promise<string>
}

export type DispatchInput = {
  outboxId: string
  line: DispatchLineTarget
  isLastAttempt: boolean
}

// Usada no guard (antes do lock) e na chamada, para as duas checagens não divergirem.
// Sem parâmetros é legítimo: a Meta valida a contagem contra a versão aprovada.
function templateDescriptorOf(
  row: WidgetOutboxRecord,
): { templateName: string; language: string; bodyParameters: string[] } | null {
  if (!row.templateName || !row.templateLanguage) return null

  return {
    templateName: row.templateName,
    language: row.templateLanguage,
    bodyParameters: row.templateParameters ?? [],
  }
}

function buttonDescriptorOf(
  row: WidgetOutboxRecord,
): InteractiveButtonDescriptor | null {
  return row.buttonPayload
}

// Provider só é chamado com `providerMessageId` nulo; senão retentativa duplica a mensagem.
// Falha com resposta HTTP é recusa (retentável); sem resposta vira `unknown` terminal.
export class DispatchWidgetOutboxMessage {
  constructor(private readonly deps: DispatchDeps) {}

  private get jobLog(): AppendJobLog {
    return this.deps.appendJobLog ?? noopJobLog
  }

  async execute(input: DispatchInput): Promise<DispatchOutcome> {
    const { outboxId, line, isLastAttempt } = input

    const row = await this.deps.outbox.findById(outboxId)
    if (!row) {
      apiLogger.warn(
        { app: 'thinkzap', outboxId },
        'Intenção de envio não encontrada; nada a despachar',
      )
      return { status: 'skipped', reason: 'missing' }
    }

    const logContext = {
      app: 'thinkzap',
      outboxId,
      subscriptionItemId: row.subscriptionItemId,
      instanceId: row.instanceId,
      destination: row.destination,
    }

    // Já entregue: só retoma os efeitos colaterais, nunca chama o provider de novo.
    if (row.providerMessageId) {
      await this.jobLog(
        `Marca de entrega já existe (${row.providerMessageId}). ` +
          'Provider NÃO será chamado — retomando apenas os efeitos colaterais.',
      )
      await this.afterDelivery(row, row.providerMessageId)
      apiLogger.info(
        { ...logContext, providerMessageId: row.providerMessageId },
        'Intenção já entregue; efeitos colaterais retomados',
      )
      return { status: 'resumed', providerMessageId: row.providerMessageId }
    }

    if (row.status === 'FAILED' || row.status === 'UNKNOWN') {
      await this.jobLog(
        `Intenção em estado terminal (${row.status}). Nada a fazer.`,
      )
      return { status: 'skipped', reason: 'terminal' }
    }

    // Execução anterior morreu durante a chamada ao provider: entrega indeterminada, não reenvia.
    if (row.status === 'SENDING') {
      await this.jobLog(
        'Intenção estava em SENDING sem marca de entrega: uma execução anterior morreu ' +
          'DURANTE a chamada ao provider. Pode ter sido entregue ou não — não há como saber daqui.',
      )
      return this.finishUnknown(
        row,
        logContext,
        'Execução anterior interrompida durante o envio ao provider',
      )
    }

    // Retentar não resolve; recusado antes do lock para não segurar o destino.
    if (row.kind === 'TEMPLATE' && !templateDescriptorOf(row)) {
      await this.jobLog(
        'Intenção de template sem templateName ou language gravados. Não há o que ' +
          'enviar e retentar não resolveria — estado terminal (FAILED). Operador avisado ' +
          'na timeline.',
      )
      await this.deps.outbox.markFailed(
        row.id,
        'Intenção de template sem templateName/language',
      )
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_send_exhausted',
        { ...logContext, outboxKind: row.kind },
        {
          level: 'error',
          msg: 'Intenção de template incompleta; envio não será tentado',
        },
      )
      await this.deps.notifyOutcome('failed', row)
      await this.reportCampaignStatus(row, 'failed')
      return { status: 'failed' }
    }

    if (row.kind === 'INTERACTIVE_BUTTON' && !buttonDescriptorOf(row)) {
      await this.jobLog(
        'Intenção de botão sem buttonPayload gravado. Não há o que enviar e ' +
          'retentar não resolveria — estado terminal (FAILED). Operador avisado na timeline.',
      )
      await this.deps.outbox.markFailed(
        row.id,
        'Intenção de botão sem buttonPayload',
      )
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_send_exhausted',
        { ...logContext, outboxKind: row.kind },
        {
          level: 'error',
          msg: 'Intenção de botão incompleta; envio não será tentado',
        },
      )
      await this.deps.notifyOutcome('failed', row)
      await this.reportCampaignStatus(row, 'failed')
      return { status: 'failed' }
    }

    // Não espera o lock: seguraria um slot de concorrência e serializaria os workers.
    const lock = await this.deps.acquireLock(row.instanceId, row.destination)
    if (!lock) {
      apiLogger.debug(logContext, 'Destino ocupado; reagendando o envio')
      await this.jobLog(
        `Outro envio em curso para ${row.destination} nesta linha. ` +
          'Reagendado para preservar a ordem — nenhuma tentativa gasta.',
      )
      return { status: 'locked' }
    }

    try {
      const claimed = await this.deps.outbox.claimForSending(row.id)
      if (!claimed) {
        apiLogger.debug(
          logContext,
          'Intenção reivindicada por outra execução; nada a fazer',
        )
        await this.jobLog(
          'Outra execução reivindicou esta intenção primeiro. Encerrando sem enviar.',
        )
        return { status: 'skipped', reason: 'claimed-by-other' }
      }

      return await this.send(row, line, logContext, isLastAttempt)
    } finally {
      await lock.release()
    }
  }

  private async send(
    row: WidgetOutboxRecord,
    line: DispatchLineTarget,
    logContext: Record<string, unknown>,
    isLastAttempt: boolean,
  ): Promise<DispatchOutcome> {
    await this.jobLog(
      `Reivindicada. Chamando ${line.provider} para ${row.destination}` +
        (row.kind === 'TEMPLATE'
          ? ` com o template "${row.templateName}" (${row.templateLanguage})...`
          : row.kind === 'INTERACTIVE_BUTTON'
            ? ' com mensagem de botões...'
            : '...'),
    )

    // Settings da linha resolvidos pelo worker a cada execução: limite alterado vale já.
    const policy = this.deps.quota
      ? dailyLimitPolicyOf({
          provider: line.provider,
          lineKey: line.instanceId,
          settings: line.settings,
        })
      : null

    let providerMessageId: string
    try {
      providerMessageId = this.deps.quota
        ? await sendWithinDailyQuota(this.deps.quota, policy, () =>
            this.callProvider(row, line),
          )
        : await this.callProvider(row, line)
    } catch (err) {
      if (isDailyLimitReachedError(err)) {
        return this.handleDailyLimitReached(row, logContext)
      }
      return this.handleSendFailure(row, logContext, isLastAttempt, err)
    }

    await this.jobLog(
      `Provider aceitou. providerMessageId=${providerMessageId} — a partir daqui ` +
        'nenhuma retentativa reenvia esta mensagem.',
    )

    // Gravar antes de qualquer efeito colateral: queda nessa janela vira `unknown`.
    await this.deps.outbox.markSent(row.id, providerMessageId)

    apiLogger.info(
      { ...logContext, providerMessageId },
      'Mensagem do widget entregue ao provider',
    )

    // `sent`, não `delivered`: ninguém confirmou entrega (a Z-API nunca confirma).
    await this.reportCampaignStatus(row, 'sent')

    await this.afterDelivery(row, providerMessageId)

    return { status: 'sent', providerMessageId }
  }

  private async reportCampaignStatus(
    row: WidgetOutboxRecord,
    status: SmsMessageStatus,
  ): Promise<void> {
    if (!row.smsSenderCode || !row.smsMessageId) return

    await this.deps.reportSmsStatus?.(row, status)
  }

  /** Sender resolvido por execução: linha reprovisionada vale na retentativa. */
  private async callProvider(
    row: WidgetOutboxRecord,
    line: DispatchLineTarget,
  ): Promise<string> {
    if (row.kind === 'TEMPLATE') {
      const descriptor = templateDescriptorOf(row)
      if (!descriptor) {
        throw new Error('Intenção de template sem templateName/language')
      }

      // Linha antiga pode ter só o `instanceId`.
      const sender = this.deps.templateSenderResolver.resolve(line.provider, {
        channelId: line.channelId ?? line.instanceId,
        recipientIdentifier: row.destination,
      })

      const { messageId } = await sender.send(descriptor)
      return messageId
    }

    if (row.kind === 'INTERACTIVE_BUTTON') {
      const descriptor = buttonDescriptorOf(row)
      if (!descriptor) {
        throw new Error('Intenção de botão sem buttonPayload')
      }

      const sender = this.deps.interactiveButtonSenderResolver.resolve(
        line.provider,
        {
          channelId: line.channelId ?? line.instanceId,
          instanceId: line.instanceId,
          instanceToken: line.zApiToken ?? undefined,
          recipientIdentifier: row.destination,
        },
      )

      const { messageId } = await sender.send(descriptor)
      return messageId
    }

    const sender = this.deps.senderResolver.resolve(line.provider, {
      instanceId: line.instanceId,
      zApiToken: line.zApiToken ?? null,
      channelId: line.channelId ?? null,
      chatId: row.destination,
    })

    const { messageId } = await sender.send({
      kind: 'text',
      text: await this.textForContact(row, line),
    })
    return messageId
  }

  /** Prefixo do operador só vai ao contato; `row.text` segue cru para canal e timeline. */
  private async textForContact(
    row: WidgetOutboxRecord,
    line: DispatchLineTarget,
  ): Promise<string> {
    const prepare = this.deps.prepareOutboundText
    if (!prepare || !line.settings || !line.appId) return row.text

    if (!row.operatorBitrixUserId) {
      apiLogger.debug(
        { app: 'thinkzap', outboxId: row.id },
        'Intenção sem operador — entregando sem prefixo de nome',
      )
      return row.text
    }

    return prepare({
      text: row.text,
      settings: line.settings,
      operatorUserId: row.operatorBitrixUserId,
      appId: line.appId,
    })
  }

  /**
   * Recusa por limite diário: terminal em **qualquer** tentativa. Retentar cairia no
   * mesmo limite até a virada do dia, e reenviar sozinho horas depois surpreenderia o
   * operador — que já foi avisado de que a mensagem não saiu.
   */
  private async handleDailyLimitReached(
    row: WidgetOutboxRecord,
    logContext: Record<string, unknown>,
  ): Promise<DispatchOutcome> {
    await this.deps.outbox.markFailed(
      row.id,
      'Recusado pelo limite diário de mensagens da linha',
    )
    logThinkzapError(
      apiLogger,
      'thinkzap.line.daily_limit_reached',
      { ...logContext, outboxKind: row.kind },
      { level: 'warn', msg: 'Envio do widget recusado pelo limite diário' },
    )
    await this.jobLog(
      'Recusado: a linha atingiu o limite diário de mensagens. Provider NÃO foi chamado. ' +
        'Estado terminal (FAILED), sem retentativa — operador avisado na timeline.',
    )
    await this.deps.notifyOutcome('daily-limit', row)
    await this.reportCampaignStatus(row, 'failed')
    return { status: 'failed' }
  }

  private async handleSendFailure(
    row: WidgetOutboxRecord,
    logContext: Record<string, unknown>,
    isLastAttempt: boolean,
    err: unknown,
  ): Promise<DispatchOutcome> {
    const failure = classifyProviderSendFailure(err)
    const message = err instanceof Error ? err.message : String(err)

    if (failure === 'indeterminate') {
      await this.jobLog(
        `Provider NÃO respondeu (timeout/rede): "${message}". ` +
          'Entrega indeterminada — pode ter saído. NÃO será reenviado: reenviar arriscaria ' +
          'mensagem duplicada no WhatsApp do contato.',
      )
      return this.finishUnknown(row, logContext, message, err)
    }

    await this.jobLog(
      `Provider RESPONDEU com erro: "${message}". Houve resposta, então nada foi entregue.`,
    )

    // Fora da última tentativa volta a PENDING (senão o próximo claim falha) e relança.
    if (isLastAttempt) {
      await this.deps.outbox.markFailed(row.id, message)
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_send_exhausted',
        { ...logContext, err, lastError: message },
        {
          level: 'error',
          msg: 'Envio pelo widget esgotou as tentativas sem entregar',
        },
      )
      await this.jobLog(
        'Última tentativa esgotada. Intenção marcada como FAILED e operador avisado na timeline.',
      )
      await this.deps.notifyOutcome('failed', row)
      // Só no esgotamento: o Bitrix não tem status para desfazer um `failed`.
      await this.reportCampaignStatus(row, 'failed')
      return { status: 'failed' }
    }

    await this.jobLog(
      'Intenção devolvida para PENDING. O BullMQ vai retentar — a mensagem NÃO está perdida.',
    )
    await this.deps.outbox.releaseToPending(row.id, message)
    throw err
  }

  private async finishUnknown(
    row: WidgetOutboxRecord,
    logContext: Record<string, unknown>,
    message: string,
    err?: unknown,
  ): Promise<DispatchOutcome> {
    await this.deps.outbox.markUnknown(row.id, message)

    logThinkzapError(
      apiLogger,
      'thinkzap.message.widget_send_unknown',
      { ...logContext, err, lastError: message },
      {
        level: 'error',
        msg: 'Não foi possível confirmar a entrega; envio não será reenviado',
      },
    )

    await this.deps.notifyOutcome('unknown', row)

    return { status: 'unknown' }
  }

  /** Nenhum passo lança: a mensagem já foi entregue e erro faria o BullMQ retentar o job. */
  private async afterDelivery(
    row: WidgetOutboxRecord,
    providerMessageId: string,
  ): Promise<void> {
    await this.persistMessage(row, providerMessageId)
    await this.enqueueOpenChannel(row, providerMessageId)
    await this.notifyTimeline(row)
    await this.jobLog(
      'Efeitos colaterais concluídos: mensagem persistida, abertura de conversa enfileirada, timeline notificada.',
    )
  }

  private async persistMessage(
    row: WidgetOutboxRecord,
    providerMessageId: string,
  ): Promise<void> {
    try {
      await this.deps.messages.create({
        instanceId: row.instanceId,
        source: 'BITRIX',
        providerMessageId,
        type: row.kind === 'INTERACTIVE_BUTTON' ? 'INTERACTIVE_BUTTON' : 'TEXT',
        text: row.text,
      })
    } catch (err) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.outbound_persist_failed',
        { app: 'thinkzap', outboxId: row.id, providerMessageId, err },
        {
          msg: 'Falha ao persistir a mensagem entregue; histórico ficará incompleto',
        },
      )
    }
  }

  private async enqueueOpenChannel(
    row: WidgetOutboxRecord,
    providerMessageId: string,
  ): Promise<void> {
    try {
      await this.deps.openChannelQueue.enqueue({
        subscriptionItemId: row.subscriptionItemId,
        domainId: row.domainId,
        appCode: row.appCode,
        instanceId: row.instanceId,
        providerMessageId,
        destination: row.destination,
        text: row.text,
        entity: row.entity,
        entityId: row.entityId,
      })
    } catch (err) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.open_channel_failed',
        { app: 'thinkzap', outboxId: row.id, err },
        {
          level: 'error',
          msg: 'Não foi possível enfileirar a abertura da conversa',
        },
      )
    }
  }

  /** `crm.timeline.comment.add` não é idempotente: o carimbo, gravado após o sucesso, evita duplicar. */
  private async notifyTimeline(row: WidgetOutboxRecord): Promise<void> {
    if (row.timelineNotifiedAt) return

    await this.deps.notifySent(row)

    try {
      await this.deps.outbox.markTimelineNotified(row.id)
    } catch (err) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_timeline_stamp_failed',
        { app: 'thinkzap', outboxId: row.id, err },
        {
          msg: 'Comentário publicado, mas o carimbo de idempotência não foi gravado',
        },
      )
    }
  }
}
