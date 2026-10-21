import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { InteractiveButtonDescriptor } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import type { OutboundMediaStorage } from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'
import type { OutboundMessageDescriptor } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import type {
  CreateWidgetOutboxInput,
  OutboxJson,
  PrismaWidgetOutboxRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { sequenceOutboxRows } from './helpers/sequence-outbox-rows'

/**
 * O que a entrega da resposta do operador precisa do evento do Bitrix: a mensagem a
 * confirmar (`imconnector.send.status.delivery`), a citação e o autor.
 */
export type OperatorOriginContext = {
  kind: 'operator'
  /** `data.LINE` do evento: o canal aberto da confirmação de entrega. */
  line: string
  im: { chat_id: string; message_id: string }
  /** `chat.id` do evento, verbatim — é também o destino da row. */
  connectorChatId: string
  bitrixUserId: string
  referencedMessageId?: string
}

export function isOperatorOriginContext(
  value: unknown,
): value is OperatorOriginContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'operator'
  )
}

export type EnqueueOperatorReplyDeps = {
  outbox: Pick<PrismaWidgetOutboxRepository, 'createParts' | 'setQueueSeq'>
  sendQueue: WidgetSendQueue
  cadence: SendCadence | null
  /**
   * Guarda privada dos anexos. Presente, o arquivo do Bitrix é baixado **agora** e
   * guardado: o link de download do canal aberto pode vencer durante a espera.
   * Ausente, a row guarda o link e o worker o usa como veio.
   */
  storage: OutboundMediaStorage | null
  download: (url: string) => Promise<{ data: Buffer; contentType?: string }>
}

export type OperatorReplyInput = {
  item: SubscriptionItem
  /** `Instance.id` (banco). */
  instanceDbId: string
  domainId: string
  appCode: string
  context: Omit<OperatorOriginContext, 'kind'>
} & (
  | { parts: OutboundMessageDescriptor[]; buttons?: never }
  | { buttons: InteractiveButtonDescriptor; parts?: never }
)

/**
 * A resposta do operador no canal aberto **pela fila**: cada parte vira uma row da
 * outbox (`origin = OPERATOR`), na ordem do evento.
 *
 * `clientMessageId = op:{bitrixMessageId}:{parte}`: o Bitrix reentrega o mesmo
 * evento, e o unique `(instanceId, clientMessageId)` faz o reprocessamento achar as
 * rows que já existem em vez de mandar a mensagem duas vezes.
 *
 * O prefixo do nome do operador não é aplicado aqui: o despacho aplica na entrega,
 * pelo `operatorBitrixUserId`, como no widget.
 */
export class EnqueueOperatorReply {
  constructor(private readonly deps: EnqueueOperatorReplyDeps) {}

  async execute(input: OperatorReplyInput): Promise<{ parts: number }> {
    const originContext: OperatorOriginContext = {
      kind: 'operator',
      ...input.context,
    }
    const bitrixMessageId = String(input.context.im.message_id)

    const base = {
      instanceId: input.instanceDbId,
      subscriptionItemId: input.item.id,
      domainId: input.domainId,
      appCode: input.appCode,
      destination: input.context.connectorChatId,
      entity: '',
      entityId: '',
      operatorBitrixUserId: input.context.bitrixUserId,
      origin: 'OPERATOR' as const,
      bitrixMessageId,
      bitrixChatId: String(input.context.im.chat_id),
      originContext: originContext as unknown as OutboxJson,
    }

    const rows: CreateWidgetOutboxInput[] = []

    if (input.buttons) {
      rows.push({
        ...base,
        clientMessageId: `op:${bitrixMessageId}:0`,
        kind: 'INTERACTIVE_BUTTON',
        text: input.buttons.body,
        buttonPayload: input.buttons,
      })
    } else {
      for (const [index, part] of input.parts.entries()) {
        const clientMessageId = `op:${bitrixMessageId}:${index}`
        if (part.kind === 'text') {
          rows.push({
            ...base,
            clientMessageId,
            kind: 'TEXT',
            text: part.text ?? '',
          })
          continue
        }
        rows.push({
          ...base,
          clientMessageId,
          kind: 'MEDIA',
          text: '',
          mediaType: part.kind,
          mediaSource: await this.mediaSourceOf(part, input.domainId),
          fileName: part.fileName ?? null,
          caption: part.text ?? null,
        })
      }
    }

    if (rows.length === 0) return { parts: 0 }

    const created = await this.deps.outbox.createParts(rows)
    await sequenceOutboxRows(
      { cadence: this.deps.cadence, outbox: this.deps.outbox },
      input.item,
      created,
    )
    for (const row of created) {
      await this.deps.sendQueue.enqueue({ outboxId: row.id })
    }
    return { parts: created.length }
  }

  private async mediaSourceOf(
    part: OutboundMessageDescriptor,
    domainId: string,
  ): Promise<OutboxJson> {
    const url = part.url ?? ''
    if (!this.deps.storage || !url) return { kind: 'url', url }

    const file = await this.deps.download(url)
    const contentType =
      file.contentType ?? part.mime ?? 'application/octet-stream'
    const stored = await this.deps.storage.store({
      data: file.data,
      contentType,
      scope: { domainId },
    })
    return { kind: 'stored', key: stored.key, contentType }
  }
}
