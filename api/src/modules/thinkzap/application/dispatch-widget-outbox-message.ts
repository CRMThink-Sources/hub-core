import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { OpenChannelConversationQueue } from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import { OutboundSenderResolver } from '@/modules/thinkzap/domain/ports/outbound-sender-resolver.port'
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
import { WidgetSendOutcome } from './notify-widget-send-outcome'

/** A credencial da linha, resolvida pelo chamador. */
export type DispatchLineTarget = {
  provider: ConnectorProvider
  /** `metadata.zApiInstanceId` ou o canal HubMessage — o id da linha no provider. */
  instanceId: string
  zApiToken?: string | null
  channelId?: string | null
}

export type DispatchOutcome =
  /** Entregue nesta execução. */
  | { status: 'sent'; providerMessageId: string }
  /** Já estava entregue; só os efeitos colaterais foram retomados. */
  | { status: 'resumed'; providerMessageId: string }
  /** O destino está ocupado — o chamador re-agenda sem gastar tentativa. */
  | { status: 'locked' }
  /** Outro worker reivindicou, ou a row já está em estado terminal. */
  | { status: 'skipped'; reason: 'claimed-by-other' | 'terminal' | 'missing' }
  | { status: 'failed' }
  | { status: 'unknown' }

export type DispatchDeps = {
  outbox: PrismaWidgetOutboxRepository
  senderResolver: OutboundSenderResolver
  messages: PrismaThinkzapMessageRepository
  openChannelQueue: OpenChannelConversationQueue
  acquireLock: (
    instanceId: string,
    destination: string,
  ) => Promise<DestinationLock | null>
  /** Aviso de desfecho ruim ao operador, na timeline da entidade. Nunca lança. */
  notifyOutcome: (
    outcome: WidgetSendOutcome,
    row: WidgetOutboxRecord,
  ) => Promise<void>
  /** O comentário de timeline do envio bem-sucedido. Nunca lança. */
  notifySent: (row: WidgetOutboxRecord) => Promise<void>
  /**
   * Log na aba Logs do job (Bull Board). Registra **decisão**, não passo a passo: cada
   * chamada é um round-trip ao Redis, e o valor está em explicar por que o provider foi
   * ou não foi chamado — não em narrar o fluxo.
   */
  appendJobLog?: AppendJobLog
}

export type DispatchInput = {
  outboxId: string
  line: DispatchLineTarget
  /** `true` quando o BullMQ não vai retentar depois desta execução. */
  isLastAttempt: boolean
}

/**
 * Entrega uma intenção do outbox ao provider e executa os efeitos colaterais.
 *
 * **A regra que governa tudo:** o provider só é chamado quando `providerMessageId` da
 * row está nulo. É esse campo que distingue "já entreguei e perdi a resposta" de "nunca
 * entreguei", e sem ele `attempts: 3` num envio outbound entregaria a mensagem três
 * vezes ao contato.
 *
 * A classificação da falha vem logo depois em importância. Falha **com resposta HTTP**
 * do provider prova recusa — nada saiu, retentar é seguro, e é o que salva a mensagem
 * de um `500` transitório, que é a dor que originou esta change. Falha **sem resposta**
 * é indeterminada e vira estado terminal `unknown`: reenviar seria apostar, e quem paga
 * a aposta errada é o contato, que lê a mesma mensagem duas vezes.
 *
 * Nunca decide sozinho o que o BullMQ faz — devolve o desfecho e quem chama traduz. A
 * única exceção é a recusa retentável, que **relança** para o BullMQ contar a tentativa.
 */
export class DispatchWidgetOutboxMessage {
  constructor(private readonly deps: DispatchDeps) {}

  /** Opcional na dependência para não obrigar os testes a passar um mock. */
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

    /**
     * Já entregue. A execução anterior gravou a marca e falhou depois, num efeito
     * colateral — retomar dali é o caminho, e chamar o provider outra vez seria o pior
     * erro possível deste código.
     */
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

    /**
     * `SENDING` sem marca de entrega: uma execução anterior reivindicou e **morreu
     * durante a chamada** ao provider. Não dá para saber se a mensagem saiu, e não se
     * reenvia.
     */
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

    /**
     * Ordem por destino. Lock tomado devolve `locked` e o chamador re-agenda **sem
     * gastar tentativa**: esperar aqui seguraria um slot de concorrência e
     * transformaria uma fila de N workers numa fila de um.
     */
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
    const sender = this.deps.senderResolver.resolve(line.provider, {
      instanceId: line.instanceId,
      zApiToken: line.zApiToken ?? null,
      channelId: line.channelId ?? null,
      chatId: row.destination,
    })

    await this.jobLog(
      `Reivindicada. Chamando ${line.provider} para ${row.destination}...`,
    )

    let providerMessageId: string
    try {
      const result = await sender.send({ kind: 'text', text: row.text })
      providerMessageId = result.messageId
    } catch (err) {
      return this.handleSendFailure(row, logContext, isLastAttempt, err)
    }

    await this.jobLog(
      `Provider aceitou. providerMessageId=${providerMessageId} — a partir daqui ` +
        'nenhuma retentativa reenvia esta mensagem.',
    )

    /**
     * A marca de entrega é gravada **imediatamente** depois do aceite, antes de
     * qualquer efeito colateral. Cada linha entre o envio e esta gravação é uma janela
     * em que uma queda transformaria mensagem entregue em `unknown`.
     */
    await this.deps.outbox.markSent(row.id, providerMessageId)

    apiLogger.info(
      { ...logContext, providerMessageId },
      'Mensagem do widget entregue ao provider',
    )

    await this.afterDelivery(row, providerMessageId)

    return { status: 'sent', providerMessageId }
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

    /**
     * Recusa com resposta: nada saiu. Na última tentativa vira `failed` e o operador é
     * avisado; antes disso a row volta para `PENDING` — sem isso o próximo `claim`
     * falharia e o job morreria em `SENDING` sem nunca ter enviado nada — e o erro sobe
     * para o BullMQ contar a tentativa.
     */
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

  /**
   * Persistência, conversa e comentário de timeline — nesta ordem, e todos depois do
   * aceite do provider.
   *
   * Nenhum deles lança: a mensagem já está no telefone do contato, e um erro que
   * subisse faria o BullMQ retentar o job inteiro. A retentativa reencontraria a marca
   * de entrega e não reenviaria, mas gastaria tentativa e ruído por um efeito que já
   * tem retentativa própria (a conversa) ou é cosmético (o comentário).
   */
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
        type: 'TEXT',
        text: row.text,
      })
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', outboxId: row.id, providerMessageId, err },
        'Falha ao persistir a mensagem entregue; histórico ficará incompleto',
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
      })
    } catch (err) {
      apiLogger.error(
        { app: 'thinkzap', outboxId: row.id, err },
        'Não foi possível enfileirar a abertura da conversa',
      )
    }
  }

  /**
   * O comentário do envio na timeline, guardado por `timelineNotifiedAt`.
   *
   * `crm.timeline.comment.add` não tem chave de idempotência, então o carimbo é a única
   * coisa que impede uma retentativa de encher a timeline do cliente com o mesmo
   * comentário. Gravado **depois** do sucesso: gravar antes esconderia um comentário
   * que nunca foi publicado.
   */
  private async notifyTimeline(row: WidgetOutboxRecord): Promise<void> {
    if (row.timelineNotifiedAt) return

    await this.deps.notifySent(row)

    try {
      await this.deps.outbox.markTimelineNotified(row.id)
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', outboxId: row.id, err },
        'Comentário publicado, mas o carimbo de idempotência não foi gravado',
      )
    }
  }
}
