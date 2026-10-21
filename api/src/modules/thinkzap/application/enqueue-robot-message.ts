import { randomUUID } from 'node:crypto'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { OutboundMediaStorage } from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'
import type { OutboundMessageDescriptor } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import type {
  CreateWidgetOutboxInput,
  PrismaWidgetOutboxRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import type { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import type { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { buildCaptionedParts } from './helpers/build-captioned-parts'
import { ensureLineInstance } from './helpers/ensure-line-instance'
import { sequenceOutboxRows } from './helpers/sequence-outbox-rows'
import type {
  RobotFileFailure,
  RobotFileResult,
} from './robot-files/fetch-robot-files'

/** O que o disparo guarda para o comentário da timeline, no fim do grupo. */
export type RobotMessageGroupMeta = {
  kind: 'robot-message'
  fromPhone: string
  message: string
  /** Ids de arquivo pedidos: com algum, o comentário lista enviados e não enviados. */
  requestedFiles: number
  /** Arquivos que não saíram do Bitrix: entram como não enviados, com o motivo. */
  failedFiles: { name: string; reason: RobotFileFailure }[]
  /** Na ordem dos disparos. */
  recipients: string[]
  /** `null` = sem timeline (fluxo fora do CRM). */
  crmDocument: { entity: string; entityId: string } | null
}

export type EnqueueRobotMessageDeps = {
  outbox: Pick<PrismaWidgetOutboxRepository, 'createParts' | 'setQueueSeq'>
  storage: OutboundMediaStorage
  sendQueue: WidgetSendQueue
  cadence: SendCadence | null
  instances: GetInstanceRepository & CreateInstanceRepository
}

const DATA_URL = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s

/**
 * O robô "Enviar mensagem" **pela fila**: cada parte de cada destinatário vira uma
 * row da outbox, todas no mesmo grupo. As regras do disparo síncrono valem iguais —
 * texto como legenda do primeiro arquivo legendável, arquivos na ordem do Bitrix,
 * arquivo ilegível ou acima de 30 MB descartado para todos antes do envio.
 *
 * Cada arquivo é guardado **uma vez**, e as partes de todos os destinatários
 * apontam para a mesma chave; o grupo apaga quando todas terminam.
 */
export class EnqueueRobotMessage {
  constructor(private readonly deps: EnqueueRobotMessageDeps) {}

  async execute(input: {
    item: SubscriptionItem
    domainId: string
    appCode: string
    workflowId: string
    message: string
    files: RobotFileResult[]
    requestedFiles: number
    recipients: string[]
    fromPhone: string
    crmDocument: { entity: string; entityId: string } | null
  }): Promise<{ queued: number }> {
    // A row tem FK para `Instance`: a âncora nasce antes de qualquer gravação.
    const instance = await ensureLineInstance(
      input.item,
      input.domainId,
      this.deps.instances,
    )

    const keys = new Map<string, { key: string; contentType: string }>()
    for (const file of input.files) {
      if (file.status !== 'ok') continue
      const match = DATA_URL.exec(file.dataUrl)
      const contentType = match?.[1] ?? file.mime
      const stored = await this.deps.storage.store({
        data: Buffer.from(match?.[2] ?? '', 'base64'),
        contentType,
        scope: { domainId: input.domainId },
      })
      keys.set(file.id, { key: stored.key, contentType })
    }

    const media: (OutboundMessageDescriptor & { fileId: string })[] =
      input.files.flatMap(file =>
        file.status === 'ok'
          ? [
              {
                kind: file.kind,
                fileName: file.name,
                mime: file.mime,
                fileId: file.id,
              },
            ]
          : [],
      )
    const template = buildCaptionedParts(input.message || undefined, media)

    const recipients = input.recipients
      .map(normalizePhoneNumber)
      .filter(isValidZApiPhoneNumber)

    const groupId = randomUUID()
    const meta: RobotMessageGroupMeta = {
      kind: 'robot-message',
      fromPhone: input.fromPhone,
      message: input.message,
      requestedFiles: input.requestedFiles,
      failedFiles: input.files.flatMap(file =>
        file.status === 'failed'
          ? [{ name: file.name, reason: file.reason }]
          : [],
      ),
      recipients,
      crmDocument: input.crmDocument,
    }

    const parts: CreateWidgetOutboxInput[] = []
    for (const destination of recipients) {
      for (const part of template) {
        const index = parts.length
        const base = {
          clientMessageId: `robot:${input.workflowId}:${groupId}:${index}`,
          instanceId: instance.id,
          subscriptionItemId: input.item.id,
          domainId: input.domainId,
          appCode: input.appCode,
          destination,
          entity: input.crmDocument?.entity ?? '',
          entityId: input.crmDocument?.entityId ?? '',
          origin: 'ROBOT_MESSAGE' as const,
          dispatchGroupId: groupId,
          partIndex: index,
          ...(index === 0 ? { dispatchMeta: meta } : {}),
        }

        if (part.kind === 'text') {
          parts.push({ ...base, kind: 'TEXT', text: part.text ?? '' })
          continue
        }

        const fileId = (part as { fileId?: string }).fileId ?? ''
        const stored = keys.get(fileId)
        if (!stored) continue
        parts.push({
          ...base,
          kind: 'MEDIA',
          text: '',
          mediaType: part.kind,
          mediaSource: { kind: 'stored', ...stored },
          fileName: part.fileName ?? null,
          caption: part.text ?? null,
        })
      }
    }

    if (parts.length === 0) return { queued: 0 }

    const rows = await this.deps.outbox.createParts(parts)
    await sequenceOutboxRows(
      { cadence: this.deps.cadence, outbox: this.deps.outbox },
      input.item,
      rows,
    )
    for (const row of rows) {
      await this.deps.sendQueue.enqueue({ outboxId: row.id })
    }

    return { queued: recipients.length }
  }
}
