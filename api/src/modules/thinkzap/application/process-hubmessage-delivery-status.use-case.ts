import type {
  HubMessageStatusEnvelope,
  HubMessageStateItem,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import {
  findStatusStateItem,
  isDeliveryFailureState,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { noopJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import type { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import type { ThinkzapMessageRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import {
  DEFAULT_NOTICE_LOCALE,
  type NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import {
  buildFailureText,
  describeHubMessageDeliveryFailure,
  readMetaErrorCode,
} from './describe-hubmessage-delivery-failure'
import type { NotifyOutcome } from './notify-operator-delivery-failed'

const log = createWorkerSourceLogger('hubmessage')

/** O mínimo do repositório de mensagens que este caminho usa. */
export type FindMessageByProviderId = {
  findByProviderMessageId(
    instanceId: string,
    providerMessageId: string,
  ): Promise<ThinkzapMessageRecord | null>
}

/** O mínimo do outbox que o status de campanha usa. */
export type FindOutboxByProviderId = {
  findByProviderMessageId(
    instanceId: string,
    providerMessageId: string,
  ): Promise<WidgetOutboxRecord | null>
}

export type ProcessHubMessageDeliveryStatusDeps = {
  instanceRepo: Pick<GetInstanceRepository, 'getInstanceByChannelId'>
  messageRepo: FindMessageByProviderId
  /**
   * O outbox, para reportar `delivered` / `undelivered` na tela de campanha do Bitrix.
   *
   * Opcional para não obrigar todo chamador a montá-lo: ausente, o aviso ao operador
   * continua igual e só o indicador de campanha deixa de ser atualizado.
   */
  outboxRepo?: FindOutboxByProviderId
  /**
   * Escreve o desfecho confirmado na tela de campanha. **Nunca lança** — a mensagem já
   * chegou (ou não) ao contato, e o que se perde aqui é um indicador.
   */
  reportSmsStatus?: (
    row: WidgetOutboxRecord,
    status: 'delivered' | 'undelivered',
  ) => Promise<void>
  domainRepo: Pick<GetDomainRepository, 'getDomainById'>
  /** Cliente Bitrix da instalação do portal — resolvido pelo nome do domínio. */
  makeBitrixClient: (domainName: string) => Promise<BitrixClient>
  /** Bot do conector, cacheado por domínio+app. */
  resolveBotId: (client: BitrixClient, domainName: string) => Promise<number>
  /** Devolve o desfecho: o Bitrix recusa com HTTP 200, então "voltou" não é "postou". */
  notifyOperator: (
    client: BitrixClient,
    botId: number,
    bitrixChatId: string,
    notice: string,
  ) => Promise<NotifyOutcome>
  /**
   * Idioma da instalação do ThinkZap no portal. Ausente, o aviso sai em português.
   * Nunca lança (o repositório de idioma cai em `pt`).
   */
  resolveLocale?: (domainId: string) => Promise<NoticeLocale>
}

/**
 * Processa o desfecho de uma mensagem que **nós** enviamos pela HubMessage
 * (`MESSAGE_DELIVERY`).
 *
 * O envio termina no aceite: `POST /messages` responde `200 { messageId }` antes de a
 * Meta processar, e o `imconnector.send.status.delivery` que disparamos ali já marcou a
 * mensagem como entregue no canal aberto. Quando a Meta recusa depois — número sem
 * aprovação de display name, janela fechada, número inválido — este callback é a única
 * coisa que sabe. Sem ele, o operador vê "entregue" e o contato não recebeu nada.
 *
 * **Nada aqui lança.** Todo caminho sem ação possível (canal que não é nosso, mensagem
 * que ainda não commitou, mensagem que não saiu do canal aberto, chat desconhecido)
 * encerra em log: exceção viraria retentativa, e a HubMessage reentregaria um evento que
 * continuaria sem ter para onde ir.
 */
export class ProcessHubMessageDeliveryStatusUseCase {
  constructor(private readonly deps: ProcessHubMessageDeliveryStatusDeps) {}

  async execute(
    envelope: HubMessageStatusEnvelope,
    context: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
  ): Promise<void> {
    const { appendJobLog } = context
    const { message } = envelope
    const stateItem = findStatusStateItem(envelope)
    const state = stateItem?.state
    const failed = isDeliveryFailureState(state)

    const logContext = {
      channelId: message.channel_id,
      providerMessageId: message._id,
      stateIdentifier: stateItem?.identifier,
      stateName: state?.name,
      deliveryFailed: failed,
      recipient: message.recipient?.identifier,
    }

    log.info(logContext, 'Processing HubMessage delivery status')
    await appendJobLog(
      `Status HubMessage | canal=${message.channel_id} | providerMessageId=${message._id} | ` +
        `estado=${state?.name ?? '—'} | erro=${failed ? 'sim' : 'não'}`,
    )

    const instance = await this.deps.instanceRepo.getInstanceByChannelId(
      message.channel_id,
    )
    if (!instance) {
      log.warn(logContext, 'Instance not found for HubMessage channel')
      await appendJobLog(
        'Nenhuma instância corresponde a este canal — evento não é nosso. Encerrado sem erro.',
      )
      return
    }

    /**
     * O status da campanha é resolvido **antes** do aviso ao operador e independente
     * dele: envio de campanha não vive no canal aberto, então as recusas que seguem
     * (`source !== BITRIX`, sem `bitrixChatId`) encerrariam o caminho sem nunca
     * chegar aqui — e a campanha ficaria eternamente em `sent` na tela do cliente.
     */
    await this.reportCampaignStatus(instance.id, message._id, failed, {
      logContext,
      appendJobLog,
    })

    const message_ = await this.deps.messageRepo.findByProviderMessageId(
      instance.id,
      message._id,
    )

    /**
     * Corrida read-your-write: o callback chegou antes de o envio commitar. Mesmo
     * tratamento do callback de status da Z-API — retentar não é confiável, e o custo
     * de errar seria postar aviso sem saber em qual chat.
     */
    if (!message_) {
      log.debug(
        { ...logContext, internalInstanceId: instance.id },
        'Mensagem do evento de status ainda não persistida',
      )
      await appendJobLog(
        'Mensagem não encontrada no banco para este providerMessageId ' +
          '(callback chegou antes do commit do envio). Encerrado sem aviso.',
      )
      return
    }

    if (message_.source !== 'BITRIX') {
      log.debug(
        { ...logContext, source: message_.source },
        'Status de mensagem que não saiu do canal aberto; ignorado',
      )
      await appendJobLog(
        `Mensagem é source=${message_.source}, não saiu do canal aberto do Bitrix. ` +
          'Fora do escopo deste aviso.',
      )
      return
    }

    if (!failed) {
      log.info(logContext, 'HubMessage delivery status sem erro; nada a avisar')
      await appendJobLog(
        `Estado ${state?.name ?? 'desconhecido'} não é recusa — só registro, sem mensagem no canal aberto.`,
      )
      return
    }

    if (!message_.bitrixChatId) {
      log.warn(
        { ...logContext, statusNoticeSkipped: true },
        'Mensagem sem bitrixChatId — sem chat para postar o aviso de recusa',
      )
      await appendJobLog(
        'Recusa recebida, mas a mensagem não tem bitrixChatId gravado — sem chat para ' +
          'postar (mensagem enviada antes desta funcionalidade). Aviso não enviado.',
      )
      return
    }

    await this.notifyFailure(message_.bitrixChatId, instance.domainId, {
      logContext,
      stateItem,
      appendJobLog,
    })
  }

  /**
   * `delivered` / `undelivered` na tela de campanha do Bitrix.
   *
   * Só a linha `HUBMESSAGE` chega aqui, e é por isso que só ela tem os dois status: é
   * o único provider que confirma entrega por mensagem no caminho que o ThinkZap usa.
   * Linha `ZAPI` para em `sent`, e dizer `delivered` sem confirmação afirmaria ao
   * cliente que a campanha chegou quando ninguém sabe.
   */
  private async reportCampaignStatus(
    instanceId: string,
    providerMessageId: string,
    failed: boolean,
    args: {
      logContext: Record<string, unknown>
      appendJobLog: AppendJobLog
    },
  ): Promise<void> {
    if (!this.deps.outboxRepo || !this.deps.reportSmsStatus) return

    const row = await this.deps.outboxRepo.findByProviderMessageId(
      instanceId,
      providerMessageId,
    )

    /** Sem as duas âncoras o envio não veio de campanha — não há onde reportar. */
    if (!row?.smsSenderCode || !row.smsMessageId) return

    const status = failed ? 'undelivered' : 'delivered'

    await this.deps.reportSmsStatus(row, status)
    await args.appendJobLog(
      `Status da campanha reportado ao Bitrix: ${status} (mensagem ${row.smsMessageId}).`,
    )
  }

  private async notifyFailure(
    bitrixChatId: string,
    domainId: string,
    args: {
      logContext: Record<string, unknown>
      stateItem: HubMessageStateItem | undefined
      appendJobLog: AppendJobLog
    },
  ): Promise<void> {
    const { logContext, stateItem, appendJobLog } = args
    const failedDescription = stateItem?.state?.failedDescription
    /**
     * O código em campo próprio, não interpolado na mensagem: é o que permite filtrar
     * por ele na observabilidade ("quantas recusas por janela fechada esta semana"),
     * pergunta que não se responde com grep em texto livre.
     */
    const metaErrorCode = readMetaErrorCode(stateItem)
    /**
     * O texto reunido das duas portas (`errors[]` e `failedDescription`). Sem isto o
     * log deste caminho ficava em "Motivo do provider: —" para um callback que a Meta
     * explicou — o mesmo silêncio que o chat tinha.
     */
    const failureText = buildFailureText(stateItem)
    const locale =
      (await this.deps.resolveLocale?.(domainId)) ?? DEFAULT_NOTICE_LOCALE
    const notice = describeHubMessageDeliveryFailure(stateItem, locale)

    /** Cru sempre no log: é a pista quando o padrão traduzido é novo. */
    log.error(
      {
        ...logContext,
        bitrixChatId,
        metaErrorCode,
        failureText,
        failedDescription,
      },
      'Meta recusou a entrega da mensagem enviada pelo canal aberto',
    )
    await appendJobLog(
      `Motivo do provider: ${failureText || '—'}` +
        (metaErrorCode ? ` | código Meta: ${metaErrorCode}` : ''),
    )

    const domain = await this.deps.domainRepo.getDomainById(domainId)
    if (!domain) {
      log.warn(
        { ...logContext, domainId, statusNoticeSkipped: true },
        'Portal da instância não encontrado; aviso de recusa não postado',
      )
      await appendJobLog(
        `Portal ${domainId} não encontrado — aviso não postado.`,
      )
      return
    }

    /**
     * A montagem do cliente e a resolução do bot vão ao Bitrix e podem falhar; o aviso
     * em si nunca lança. Um `try` aqui é o que impede que "não deu para avisar" vire
     * job falho e retentativa de um desfecho imutável.
     */
    try {
      const bitrixClient = await this.deps.makeBitrixClient(domain.name)
      const botId = await this.deps.resolveBotId(bitrixClient, domain.name)

      const outcome = await this.deps.notifyOperator(
        bitrixClient,
        botId,
        bitrixChatId,
        notice,
      )

      /**
       * O desfecho vem do id de mensagem que o Bitrix devolveu, não do fato de a
       * chamada ter voltado: `imbot.message.add` recusa com HTTP 200 e `error` no
       * corpo, e a aba Logs afirmando "postado" para uma mensagem que não existe é
       * pior que aba vazia — manda procurar no Bitrix o que nunca chegou lá.
       */
      if (outcome.posted) {
        /**
         * `via=` é o método que de fato aceitou. São dois candidatos (bot e usuário do
         * app), e qual deles passa depende do portal — sem isto na aba, descobrir qual
         * está em uso exigiria repetir o diagnóstico contra a instalação do cliente.
         */
        await appendJobLog(
          `Aviso postado no chat ${bitrixChatId} via ${outcome.method} ` +
            `(bot ${botId}, mensagem ${outcome.bitrixMessageId}): ${notice}`,
        )
        return
      }

      log.warn(
        { ...logContext, bitrixChatId, botId, statusNoticeSkipped: true },
        'Bitrix não criou a mensagem de aviso no canal aberto',
      )
      await appendJobLog(
        `Bitrix NÃO criou a mensagem de aviso no chat ${bitrixChatId} (bot ${botId}): ${outcome.reason}`,
      )
    } catch (err) {
      log.warn(
        { ...logContext, bitrixChatId, err, statusNoticeSkipped: true },
        'Falha ao preparar o aviso de recusa no canal aberto',
      )
      await appendJobLog(
        `Falha ao preparar o aviso no Bitrix: ${err instanceof Error ? err.message : String(err)}. ` +
          'Encerrado sem retentativa — o desfecho da mensagem não muda.',
      )
    }
  }
}
