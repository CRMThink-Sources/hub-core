import { randomUUID } from 'node:crypto'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { OutboundMediaStorage } from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import type {
  CreateWidgetOutboxInput,
  OutboxMediaType,
  PrismaWidgetOutboxRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { sequenceOutboxRows } from './helpers/sequence-outbox-rows'
import type {
  WidgetAttachmentKind,
  WidgetMessageAttachmentInput,
} from './send-widget-message.types'

export type EnqueuedWidgetAttachmentsResult = {
  status: 'queued'
  destination: string
  /** Um por parte (texto e cada anexo), na ordem de envio. */
  clientMessageIds: string[]
}

/** O que o grupo de anexos guarda para a timeline e a conversa no fim. */
export type WidgetAttachmentGroupMeta = {
  kind: 'widget-attachment'
  message: string | null
  attachmentKinds: WidgetAttachmentKind[]
}

const MEDIA_TYPE_BY_KIND: Record<WidgetAttachmentKind, OutboxMediaType> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'document',
}

const DATA_URL = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s

function decodeDataUrl(content: string): { data: Buffer; contentType: string } {
  const match = DATA_URL.exec(content)
  if (!match) {
    return {
      data: Buffer.from(content.trim(), 'base64'),
      contentType: 'application/octet-stream',
    }
  }
  return {
    data: Buffer.from(match[2] ?? '', 'base64'),
    contentType: match[1] ?? 'application/octet-stream',
  }
}

export type EnqueueWidgetAttachmentsDeps = {
  outbox: Pick<PrismaWidgetOutboxRepository, 'createParts' | 'setQueueSeq'>
  storage: OutboundMediaStorage
  sendQueue: WidgetSendQueue
  cadence: SendCadence | null
}

/**
 * O envio com anexo pelo widget **pela fila**: cada parte (o texto e cada anexo)
 * vira uma row da outbox no mesmo grupo, e o arquivo vai para a guarda privada até
 * a vez dele.
 *
 * As regras do envio síncrono valem iguais: texto primeiro, anexos depois, sem
 * legenda, na ordem em que vieram. O que muda é o momento — a timeline e a conversa
 * saem quando o grupo termina (`settleWidgetAttachmentGroup`), não no request.
 */
export class EnqueueWidgetAttachments {
  constructor(private readonly deps: EnqueueWidgetAttachmentsDeps) {}

  async execute(input: {
    item: SubscriptionItem
    instanceId: string
    subscriptionItemId: string
    domainId: string
    appCode: string
    destination: string
    message?: string
    attachments: WidgetMessageAttachmentInput[]
    entity: string
    entityId: string
    operatorBitrixUserId?: string
  }): Promise<EnqueuedWidgetAttachmentsResult> {
    const groupId = randomUUID()
    const text = input.message?.trim() || null

    const base = {
      instanceId: input.instanceId,
      subscriptionItemId: input.subscriptionItemId,
      domainId: input.domainId,
      appCode: input.appCode,
      destination: input.destination,
      entity: input.entity,
      entityId: input.entityId,
      operatorBitrixUserId: input.operatorBitrixUserId ?? null,
      origin: 'WIDGET_ATTACHMENT' as const,
      dispatchGroupId: groupId,
    }

    const meta: WidgetAttachmentGroupMeta = {
      kind: 'widget-attachment',
      message: text,
      attachmentKinds: input.attachments.map(a => a.kind),
    }

    const parts: Omit<CreateWidgetOutboxInput, 'clientMessageId'>[] = []
    if (text) {
      parts.push({ ...base, kind: 'TEXT', text })
    }

    // Os arquivos vão para a guarda antes de qualquer row: falha aqui não deixa nada.
    for (const attachment of input.attachments) {
      const { data, contentType } = decodeDataUrl(attachment.content)
      const stored = await this.deps.storage.store({
        data,
        contentType,
        scope: { domainId: input.domainId },
      })
      parts.push({
        ...base,
        kind: 'MEDIA',
        text: '',
        mediaType: MEDIA_TYPE_BY_KIND[attachment.kind],
        mediaSource: { kind: 'stored', key: stored.key, contentType },
        fileName: attachment.name ?? null,
      })
    }

    const numbered = parts.map((part, index) => ({
      ...part,
      clientMessageId: `${groupId}:${index}`,
      partIndex: index,
      ...(index === 0 ? { dispatchMeta: meta } : {}),
    }))

    const rows = await this.deps.outbox.createParts(numbered)

    await sequenceOutboxRows(
      { cadence: this.deps.cadence, outbox: this.deps.outbox },
      input.item,
      rows,
    )

    for (const row of rows) {
      await this.deps.sendQueue.enqueue({ outboxId: row.id })
    }

    return {
      status: 'queued',
      destination: input.destination,
      clientMessageIds: rows.map(row => row.clientMessageId),
    }
  }
}
