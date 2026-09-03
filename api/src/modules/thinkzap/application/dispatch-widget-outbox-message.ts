import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
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

/** A credencial da linha, resolvida pelo chamador. */
export type DispatchLineTarget = {
  provider: ConnectorProvider
  /** `metadata.zApiInstanceId` ou o canal HubMessage — o id da linha no provider. */
  instanceId: string
  zApiToken?: string | null
  channelId?: string | null
  /**
   * Os toggles da linha, do item da SPA. Vêm na mesma resolução da credencial: quem
   * acha o item para saber por onde enviar já tem em mãos como enviar.
   */
  settings?: ConnectorSettings
  /** `core_apps.id` da instalação — para resolver o nome do operador. */
  appId?: string
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
  /**
   * O resolver de template, para as intenções de `kind: 'TEMPLATE'`.
   *
   * Port separado e não uma variante de `OutboundSenderResolver` porque as duas
   * chamadas não têm o mesmo formato: uma leva texto, a outra leva o par (template,
   * parâmetros) e é escopada por canal + destinatário. Unir os dois obrigaria a
   * assinatura de envio livre a carregar campos que nunca usa.
   */
  templateSenderResolver: TemplateMessageSenderResolver
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
   * Escreve o desfecho na tela de campanha do Bitrix, para as rows que vieram de uma.
   *
   * Porta e não import direto pelo mesmo motivo de `prepareOutboundText`: fala com o
   * Bitrix, e o despacho é testado sem rede. Ausente, nada é reportado — que é o
   * comportamento correto para todo envio que não veio de campanha.
   *
   * **Nunca lança.** A mensagem já foi entregue quando isto roda; um erro aqui não
   * pode desfazer, reenfileirar nem marcar como falho um envio que deu certo.
   */
  reportSmsStatus?: (
    row: WidgetOutboxRecord,
    status: SmsMessageStatus,
  ) => Promise<void>
  /**
   * Log na aba Logs do job (Bull Board). Registra **decisão**, não passo a passo: cada
   * chamada é um round-trip ao Redis, e o valor está em explicar por que o provider foi
   * ou não foi chamado — não em narrar o fluxo.
   */
  appendJobLog?: AppendJobLog
  /**
   * Preparo do texto que vai para o contato — na prática,
   * `prepareOpenLineOutboundText`, o mesmo que o canal aberto do Bitrix usa.
   *
   * Entra como porta e não como import direto porque ele fala com o Bitrix, e o
   * despacho é testado sem rede. Ausente, o texto sai cru: é o comportamento de antes
   * desta porta existir.
   */
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
  /** `true` quando o BullMQ não vai retentar depois desta execução. */
  isLastAttempt: boolean
}

/**
 * O template na forma que o provider recebe, ou `null` se a row não o descreve por
 * inteiro.
 *
 * Uma função só, usada nos dois pontos que precisam da resposta — o guard terminal, que
 * decide **antes** do lock, e a chamada, que já pode confiar. Duas checagens separadas
 * divergiriam: a do guard cobriria um campo que a da chamada não cobre, e a intenção
 * quebrada passaria pelo primeiro para morrer no segundo, com o destino travado e uma
 * tentativa gasta.
 *
 * `bodyParameters` ausente vira lista vazia, e não recusa: template sem variável é
 * legítimo, e é a Meta quem valida a contagem contra a versão aprovada.
 */
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
     * Intenção de template sem o que identifica a versão aprovada.
     *
     * Estado impossível pelo caminho normal — `EnqueueWidgetTemplateUseCase` grava os
     * três campos juntos —, e ainda assim terminal e não retentável: nenhuma das três
     * tentativas faria o nome do template aparecer na row. Recusado **antes** do lock e
     * do claim, para não segurar o destino por uma intenção que não tem como sair.
     */
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
    await this.jobLog(
      `Reivindicada. Chamando ${line.provider} para ${row.destination}` +
        (row.kind === 'TEMPLATE'
          ? ` com o template "${row.templateName}" (${row.templateLanguage})...`
          : '...'),
    )

    let providerMessageId: string
    try {
      providerMessageId = await this.callProvider(row, line)
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

    /**
     * `sent` e não `delivered`: o provider aceitou, ninguém confirmou entrega ainda.
     * Linha `ZAPI` para aqui — a Z-API não confirma entrega por mensagem no caminho
     * que o ThinkZap usa, e dizer `delivered` sem confirmação afirmaria ao cliente que
     * a campanha chegou quando ninguém sabe.
     */
    await this.reportCampaignStatus(row, 'sent')

    await this.afterDelivery(row, providerMessageId)

    return { status: 'sent', providerMessageId }
  }

  /**
   * Reporta o desfecho na tela de campanha do Bitrix — só para row que veio de uma.
   *
   * As duas âncoras juntas são a marca de origem: envio de widget e de robô as tem
   * nulas e não reporta nada, que é o comportamento correto — não há campanha onde
   * escrever.
   */
  private async reportCampaignStatus(
    row: WidgetOutboxRecord,
    status: SmsMessageStatus,
  ): Promise<void> {
    if (!row.smsSenderCode || !row.smsMessageId) return

    await this.deps.reportSmsStatus?.(row, status)
  }

  /**
   * A **única** diferença entre entregar uma mensagem livre e entregar um template.
   *
   * Tudo o que protege a mensagem do contato — a marca de entrega, o claim
   * condicional, o lock por destino, a classificação da falha, os efeitos colaterais —
   * é idêntico nos dois e fica fora daqui de propósito. Duplicar o `execute` inteiro
   * por causa de uma chamada seria duplicar as garantias, e a segunda cópia começaria a
   * divergir da primeira no primeiro ajuste.
   *
   * A resolução do sender é **por execução**, não guardada: uma linha reprovisionada
   * entre o clique e a retentativa passa a valer com a credencial nova.
   */
  private async callProvider(
    row: WidgetOutboxRecord,
    line: DispatchLineTarget,
  ): Promise<string> {
    if (row.kind === 'TEMPLATE') {
      const descriptor = templateDescriptorOf(row)
      if (!descriptor) {
        throw new Error('Intenção de template sem templateName/language')
      }

      /**
       * Mesmo fallback do resolver de envio livre: o provisionamento grava o
       * `channelId` nos dois campos, mas linha antiga pode ter só o `instanceId`.
       */
      const sender = this.deps.templateSenderResolver.resolve(line.provider, {
        channelId: line.channelId ?? line.instanceId,
        recipientIdentifier: row.destination,
      })

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

  /**
   * O texto como o **contato** o lê — que não é `row.text`.
   *
   * `row.text` alimenta o espelho no canal aberto, o comentário de timeline e o aviso
   * de falha; nos três o autor já é conhecido. O prefixo de nome é só desta chamada, e
   * é por isso que ele é montado aqui em vez de ser gravado na intenção.
   *
   * Row sem operador é de antes da coluna existir: entrega crua, como sempre entregou.
   */
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
      /**
       * Só no esgotamento. Reportar `failed` a cada tentativa faria a tela de campanha
       * mostrar falha enquanto o worker ainda tem retentativa pela frente — e o Bitrix
       * não tem status de "tentando de novo" para desfazer isso.
       */
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
        entity: row.entity,
        entityId: row.entityId,
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
