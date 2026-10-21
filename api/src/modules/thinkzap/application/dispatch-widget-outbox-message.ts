import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { InteractiveButtonDescriptor } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { InteractiveButtonSenderResolver } from '@/modules/thinkzap/domain/ports/interactive-button-sender-resolver.port'
import { OpenChannelConversationQueue } from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import { OutboundSenderResolver } from '@/modules/thinkzap/domain/ports/outbound-sender-resolver.port'
import { TemplateMessageSenderResolver } from '@/modules/thinkzap/domain/ports/template-sender-resolver.port'
import { TemplateMessageDescriptor } from '@/modules/thinkzap/domain/ports/template-message-sender.port'
import { classifyProviderSendFailure } from '@/modules/thinkzap/infra/adapters/classify-provider-send-failure'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  OutboxGroupPart,
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { OutboundMediaNotFoundError } from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'
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
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import {
  CadencePolicy,
  cadencePolicyOf,
} from '@/modules/thinkzap/domain/send-cadence'
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
  /**
   * Sem vaga na cadência ou fora da vez na fila da linha: o chamador re-agenda para
   * `retryAt` (epoch ms) sem gastar tentativa — nada foi reivindicado.
   */
  | {
      status: 'deferred'
      retryAt: number
      reason: 'paused' | 'window-full' | 'not-head'
    }

/** Um grupo cujas partes chegaram todas ao desfecho final. */
export type SettledDispatchGroup = {
  dispatchGroupId: string
  /** A row de `partIndex = 0` — carrega `dispatchMeta`. */
  first: WidgetOutboxRecord
  parts: OutboxGroupPart[]
}

/** `lastError` gravado na parte recusada pelo limite diário — o grupo conta por ele. */
export const DAILY_LIMIT_FAILURE =
  'Recusado pelo limite diário de mensagens da linha'
/** `lastError` da parte cujo arquivo não existe mais. */
export const MEDIA_EXPIRED_FAILURE = 'Arquivo do anexo não está mais disponível'

const TERMINAL_STATUSES = new Set(['SENT', 'FAILED', 'UNKNOWN'])

const PERSISTED_TYPE_BY_MEDIA = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
  document: 'DOCUMENT',
} as const

/** A espera de uma row por cadência, para quem precisa avisar alguém dela. */
export type CadenceDeferral = {
  retryAt: number
  reason: 'paused' | 'window-full'
  /**
   * Identifica **esta** espera (a janela cheia ou a pausa): várias mensagens na
   * mesma espera compartilham a chave, e o aviso ao operador sai uma vez só.
   */
  waitKey: string
}

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
  /**
   * Cadência e fila FIFO da linha. Ausente, o envio não espera janela nem vez — só
   * os testes que não falam de cadência a omitem; o worker sempre injeta.
   */
  cadence?: SendCadence
  /**
   * A row foi adiada por cadência (pausa ou janela cheia). Nunca lança: é aviso,
   * não muda o desfecho. "Fora da vez" não chama — não é espera de cadência.
   */
  onCadenceDeferred?: (
    row: WidgetOutboxRecord,
    deferral: CadenceDeferral,
  ) => Promise<void>
  /** Relógio injetável para os testes. */
  now?: () => Date
  /**
   * O arquivo de uma parte `MEDIA`, obtido **na hora do envio** a partir de
   * `mediaSource` (guarda privada, arquivo do Bitrix). Lança
   * `OutboundMediaNotFoundError` quando o arquivo não existe mais.
   */
  resolveMedia?: (row: WidgetOutboxRecord) => Promise<{ url: string }>
  /** Apaga o arquivo guardado de uma parte `MEDIA` terminada. Nunca lança. */
  releaseMedia?: (
    row: Pick<WidgetOutboxRecord, 'id' | 'mediaSource'>,
  ) => Promise<void>
  /**
   * Todas as partes de um grupo (anexos do widget, disparo do robô) terminaram. É
   * aqui, e não por parte, que saem a timeline e a abertura da conversa. Chamado
   * uma vez por grupo (carimbo condicional). Nunca lança.
   */
  onGroupSettled?: (settled: SettledDispatchGroup) => Promise<void>
  /**
   * Entrega da origem que tem efeitos próprios (resposta do operador: histórico
   * com o id do Bitrix e confirmação no canal aberto; fala do bot: eco no chat).
   * `true` = tratada, e os efeitos do widget (histórico simples, abertura de
   * conversa, timeline) não rodam. Nunca lança.
   */
  onDelivered?: (
    row: WidgetOutboxRecord,
    providerMessageId: string,
  ) => Promise<boolean>
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
// Os botões vêm da row, não de nova leitura do catálogo: o reprocessamento reenvia
// exatamente os valores aceitos no pedido.
function templateDescriptorOf(
  row: WidgetOutboxRecord,
): TemplateMessageDescriptor | null {
  if (!row.templateName || !row.templateLanguage) return null

  return {
    templateName: row.templateName,
    language: row.templateLanguage,
    bodyParameters: row.templateParameters ?? [],
    buttonParameters: row.templateButtonParameters ?? [],
    ...(row.templateHeaderImageUrl
      ? { headerImageUrl: row.templateHeaderImageUrl }
      : {}),
  }
}

/**
 * A citação da resposta do operador, quando o evento trazia uma — como argumento
 * extra do `send`, ausente (e não `undefined`) quando não há.
 */
function sendArgsOf(
  row: WidgetOutboxRecord,
): [] | [{ referencedMessageId: string }] {
  const referenced = row.originContext?.referencedMessageId
  return typeof referenced === 'string' && referenced
    ? [{ referencedMessageId: referenced }]
    : []
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

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date()
  }

  private cadencePolicy(line: DispatchLineTarget): CadencePolicy | null {
    if (!this.deps.cadence) return null
    return cadencePolicyOf({
      provider: line.provider,
      lineKey: line.instanceId,
      settings: line.settings,
    })
  }

  async execute(input: DispatchInput): Promise<DispatchOutcome> {
    const outcome = await this.dispatch(input)

    /**
     * Desfecho terminal tira a row da fila FIFO da linha — inclusive os que nem
     * chegaram a pedir vaga (row terminal, incompleta, sumida). Sem isso ela ficaria
     * na cabeça segurando a linha até a varredura. `locked` e `deferred` mantêm a
     * vez; exceção (retentativa do BullMQ) também, para a row voltar à mesma posição.
     */
    if (outcome.status !== 'locked' && outcome.status !== 'deferred') {
      await this.afterTerminal(input.outboxId)

      const policy = this.cadencePolicy(input.line)
      if (policy) {
        await this.deps.cadence
          ?.dequeue(policy.lineKey, input.outboxId)
          .catch(err =>
            apiLogger.warn(
              { app: 'thinkzap', outboxId: input.outboxId, err },
              'Falha ao tirar a row da fila FIFO; a varredura recolhe',
            ),
          )
      }
    }

    return outcome
  }

  /**
   * O que acontece quando uma row chega ao fim: o arquivo guardado é apagado, e o
   * grupo dela, se todas as partes terminaram, é concluído uma vez só.
   */
  private async afterTerminal(outboxId: string): Promise<void> {
    if (!this.deps.releaseMedia && !this.deps.onGroupSettled) return

    try {
      const row = await this.deps.outbox.findById(outboxId)
      if (!row || !TERMINAL_STATUSES.has(row.status)) return

      if (!row.dispatchGroupId) {
        if (row.kind === 'MEDIA') await this.deps.releaseMedia?.(row)
        return
      }

      const parts = await this.deps.outbox.groupOutcome(row.dispatchGroupId)
      if (parts.some(part => !TERMINAL_STATUSES.has(part.status))) return
      if (
        !(await this.deps.outbox.claimGroupTimelineNotification(
          row.dispatchGroupId,
        ))
      ) {
        return
      }

      const first =
        parts[0]?.id === row.id
          ? row
          : await this.deps.outbox.findById(parts[0]!.id)
      await this.deps.onGroupSettled?.({
        dispatchGroupId: row.dispatchGroupId,
        first: first ?? row,
        parts,
      })

      /**
       * Os arquivos do grupo só saem quando **todas** as partes terminaram: no robô,
       * um arquivo é guardado uma vez e enviado a cada destinatário. Uma chave por
       * vez, mesmo que várias partes a compartilhem.
       */
      const released = new Set<string>()
      for (const part of parts) {
        if (part.kind !== 'MEDIA') continue
        const key = JSON.stringify(part.mediaSource)
        if (released.has(key)) continue
        released.add(key)
        await this.deps.releaseMedia?.(part)
      }
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', outboxId, err },
        'Conclusão da row (arquivo/grupo) falhou; o envio não muda',
      )
    }
  }

  /** Parte de grupo não avisa sozinha: o desfecho sai agregado em `onGroupSettled`. */
  private async notifyRowOutcome(
    outcome: WidgetSendOutcome,
    row: WidgetOutboxRecord,
  ): Promise<void> {
    if (row.dispatchGroupId) return
    await this.deps.notifyOutcome(outcome, row)
  }

  private async dispatch(input: DispatchInput): Promise<DispatchOutcome> {
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
      await this.notifyRowOutcome('failed', row)
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
      await this.notifyRowOutcome('failed', row)
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
      /**
       * A vaga da cadência vem **antes** do claim: negada, a row continua PENDING e
       * nenhuma tentativa é gasta. Depois da trava por destino, para que a vez na
       * fila seja pedida por quem de fato pode enviar agora.
       */
      const slot = await this.reserveCadenceSlot(row, line, logContext)
      if (slot.status === 'deferred') return slot

      const claimed = await this.deps.outbox.claimForSending(row.id)
      if (!claimed) {
        await slot.release()
        apiLogger.debug(
          logContext,
          'Intenção reivindicada por outra execução; nada a fazer',
        )
        await this.jobLog(
          'Outra execução reivindicou esta intenção primeiro. Encerrando sem enviar.',
        )
        return { status: 'skipped', reason: 'claimed-by-other' }
      }

      return await this.send(row, line, logContext, isLastAttempt, slot)
    } finally {
      await lock.release()
    }
  }

  /**
   * Pede a vaga na janela e a vez na fila FIFO da linha. Linha sem cadência (oficial,
   * ou cadência não injetada) recebe uma vaga que não devolve nada.
   */
  private async reserveCadenceSlot(
    row: WidgetOutboxRecord,
    line: DispatchLineTarget,
    logContext: Record<string, unknown>,
  ): Promise<
    | { status: 'granted'; release: () => Promise<void> }
    | Extract<DispatchOutcome, { status: 'deferred' }>
  > {
    const cadence = this.deps.cadence
    const policy = this.cadencePolicy(line)
    if (!cadence || !policy) {
      return { status: 'granted', release: async () => {} }
    }

    // Row sem posição (Redis falhou no enfileiramento): entra no fim da fila agora.
    let seq = row.queueSeq
    if (seq == null) {
      seq = await cadence.enqueue(policy.lineKey, row.id)
      await this.deps.outbox.setQueueSeq(row.id, seq)
    }

    const now = this.now()
    const outcome = await cadence.reserve(
      policy,
      { outboxId: row.id, seq },
      now,
    )

    if (outcome.allowed) {
      let released = false
      return {
        status: 'granted',
        release: async () => {
          if (released) return
          released = true
          await cadence.release(policy.lineKey, outcome.windowId)
        },
      }
    }

    if (outcome.reason === 'not-head') {
      apiLogger.debug(logContext, 'Fora da vez na fila da linha; reagendando')
      return {
        status: 'deferred',
        retryAt: outcome.retryAt,
        reason: outcome.reason,
      }
    }

    const waitUntil = new Date(outcome.retryAt)
    await this.deps.outbox.markWaiting(row.id, waitUntil)
    await this.jobLog(
      (outcome.reason === 'paused'
        ? 'Linha em pausa da cadência'
        : 'Janela da cadência cheia') +
        ` — reagendado para ${waitUntil.toISOString()} sem gastar tentativa.`,
    )
    apiLogger.info(
      { ...logContext, retryAt: outcome.retryAt, reason: outcome.reason },
      'Envio adiado pela cadência da linha',
    )

    if (this.deps.onCadenceDeferred) {
      try {
        await this.deps.onCadenceDeferred(row, {
          retryAt: outcome.retryAt,
          reason: outcome.reason,
          waitKey: `${outcome.reason}:${outcome.retryAt}`,
        })
      } catch (err) {
        apiLogger.warn(
          { ...logContext, err },
          'Aviso de espera por cadência falhou; o desfecho não muda',
        )
      }
    }

    return {
      status: 'deferred',
      retryAt: outcome.retryAt,
      reason: outcome.reason,
    }
  }

  private async send(
    row: WidgetOutboxRecord,
    line: DispatchLineTarget,
    logContext: Record<string, unknown>,
    isLastAttempt: boolean,
    slot: { release: () => Promise<void> } = { release: async () => {} },
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

    /**
     * O arquivo é obtido **antes** da cota diária: arquivo que não existe mais não
     * gasta vaga. Expirado é terminal (retentar não o traz de volta); armazenamento
     * fora do ar volta a PENDING e relança, como qualquer falha antes do provider.
     */
    let media: { url: string } | null = null
    if (row.kind === 'MEDIA') {
      try {
        media = await this.resolveMediaOf(row)
      } catch (err) {
        await slot.release().catch(() => {})
        return this.handleMediaUnavailable(row, logContext, isLastAttempt, err)
      }
    }

    let providerMessageId: string
    try {
      providerMessageId = this.deps.quota
        ? await sendWithinDailyQuota(this.deps.quota, policy, () =>
            this.callProvider(row, line, media),
          )
        : await this.callProvider(row, line, media)
    } catch (err) {
      /**
       * A vaga da cadência segue a regra da cota diária: nada saiu (recusa da cota,
       * provider respondeu com erro) devolve; sem resposta, a entrega é incerta e a
       * vaga fica. A retentativa pede vaga de novo — a mesma mensagem não conta duas
       * vezes.
       */
      if (
        isDailyLimitReachedError(err) ||
        classifyProviderSendFailure(err) !== 'indeterminate'
      ) {
        await slot
          .release()
          .catch(releaseErr =>
            apiLogger.warn(
              { ...logContext, err: releaseErr },
              'Falha ao devolver a vaga da cadência',
            ),
          )
      }
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

  private async resolveMediaOf(
    row: WidgetOutboxRecord,
  ): Promise<{ url: string }> {
    if (!this.deps.resolveMedia || !row.mediaType) {
      throw new OutboundMediaNotFoundError(row.id)
    }
    return this.deps.resolveMedia(row)
  }

  private async handleMediaUnavailable(
    row: WidgetOutboxRecord,
    logContext: Record<string, unknown>,
    isLastAttempt: boolean,
    err: unknown,
  ): Promise<DispatchOutcome> {
    const expired = err instanceof OutboundMediaNotFoundError
    if (!expired && !isLastAttempt) {
      await this.jobLog(
        'Arquivo do anexo não pôde ser lido agora. Intenção devolvida para PENDING — ' +
          'o BullMQ vai retentar.',
      )
      await this.deps.outbox.releaseToPending(
        row.id,
        err instanceof Error ? err.message : String(err),
      )
      throw err
    }

    await this.deps.outbox.markFailed(
      row.id,
      expired
        ? MEDIA_EXPIRED_FAILURE
        : err instanceof Error
          ? err.message
          : String(err),
    )
    logThinkzapError(
      apiLogger,
      'thinkzap.message.widget_send_exhausted',
      { ...logContext, outboxKind: row.kind, err },
      {
        level: 'error',
        msg: expired
          ? 'Arquivo do anexo expirou na fila; parte não enviada'
          : 'Arquivo do anexo ilegível; tentativas esgotadas',
      },
    )
    await this.jobLog(
      'Arquivo do anexo indisponível. Provider NÃO foi chamado. Estado terminal (FAILED).',
    )
    await this.notifyRowOutcome('failed', row)
    return { status: 'failed' }
  }

  /** Sender resolvido por execução: linha reprovisionada vale na retentativa. */
  private async callProvider(
    row: WidgetOutboxRecord,
    line: DispatchLineTarget,
    media: { url: string } | null = null,
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

    if (row.kind === 'MEDIA' && media && row.mediaType) {
      const { messageId } = await sender.send(
        {
          kind: row.mediaType,
          url: media.url,
          ...(row.caption
            ? {
                text: await this.textForContact(
                  { ...row, text: row.caption },
                  line,
                ),
              }
            : {}),
          ...(row.fileName ? { fileName: row.fileName } : {}),
        },
        ...sendArgsOf(row),
      )
      return messageId
    }

    const { messageId } = await sender.send(
      {
        kind: 'text',
        text: await this.textForContact(row, line),
      },
      ...sendArgsOf(row),
    )
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
    await this.deps.outbox.markFailed(row.id, DAILY_LIMIT_FAILURE)
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
    await this.notifyRowOutcome('daily-limit', row)
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
      await this.notifyRowOutcome('failed', row)
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

    await this.notifyRowOutcome('unknown', row)

    return { status: 'unknown' }
  }

  /** Nenhum passo lança: a mensagem já foi entregue e erro faria o BullMQ retentar o job. */
  private async afterDelivery(
    row: WidgetOutboxRecord,
    providerMessageId: string,
  ): Promise<void> {
    if (this.deps.onDelivered) {
      try {
        if (await this.deps.onDelivered(row, providerMessageId)) {
          await this.jobLog(
            `Efeitos da origem ${row.origin} concluídos após a entrega.`,
          )
          return
        }
      } catch (err) {
        apiLogger.warn(
          { app: 'thinkzap', outboxId: row.id, origin: row.origin, err },
          'Efeitos da entrega falharam; a mensagem já saiu',
        )
        return
      }
    }

    await this.persistMessage(row, providerMessageId)

    // Parte de grupo: conversa e timeline saem uma vez, em `onGroupSettled`.
    if (row.dispatchGroupId) {
      await this.jobLog(
        'Parte do grupo entregue e persistida; conversa e timeline saem quando o grupo terminar.',
      )
      return
    }

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
        ...(row.kind === 'MEDIA' && row.mediaType
          ? {
              type: PERSISTED_TYPE_BY_MEDIA[row.mediaType],
              text: row.caption,
              // Só documento grava o nome, como o envio síncrono e o operador.
              fileName: row.mediaType === 'document' ? row.fileName : null,
            }
          : {
              type:
                row.kind === 'INTERACTIVE_BUTTON'
                  ? 'INTERACTIVE_BUTTON'
                  : 'TEXT',
              text: row.text,
            }),
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
