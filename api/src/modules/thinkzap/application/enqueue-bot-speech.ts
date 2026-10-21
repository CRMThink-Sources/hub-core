import { randomUUID } from 'node:crypto'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import type {
  OutboxJson,
  PrismaWidgetOutboxRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { sequenceOutboxRows } from './helpers/sequence-outbox-rows'

/** O que o eco da fala no chat do canal aberto precisa, depois da entrega. */
export type BotOriginContext = {
  kind: 'bot'
  /** `core_apps.id`: credencial do portal e registro do bot. */
  appId: string
  bitrixBotId: number
}

export function isBotOriginContext(value: unknown): value is BotOriginContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'bot'
  )
}

export type EnqueueBotSpeechDeps = {
  outbox: Pick<PrismaWidgetOutboxRepository, 'createParts' | 'setQueueSeq'>
  sendQueue: WidgetSendQueue
  cadence: SendCadence | null
}

/**
 * A fala do bot **pela fila** (`origin = BOT`): o contato recebe quando chegar a
 * vez, e o eco no chat do canal aberto só acontece depois da entrega — o histórico
 * nunca mostra uma fala que o contato não recebeu.
 *
 * O destino é o **chat do conector** (telefone/LID do contato), não o chat do
 * Bitrix: é ele que a Z-API entende.
 */
export class EnqueueBotSpeech {
  constructor(private readonly deps: EnqueueBotSpeechDeps) {}

  async execute(input: {
    item: SubscriptionItem
    instanceDbId: string
    domainId: string
    appCode: string
    connectorChatId: string
    bitrixChatId: string
    text: string
    context: Omit<BotOriginContext, 'kind'>
  }): Promise<void> {
    const originContext: BotOriginContext = { kind: 'bot', ...input.context }

    const rows = await this.deps.outbox.createParts([
      {
        clientMessageId: `bot:${input.bitrixChatId}:${randomUUID()}`,
        instanceId: input.instanceDbId,
        subscriptionItemId: input.item.id,
        domainId: input.domainId,
        appCode: input.appCode,
        destination: input.connectorChatId,
        text: input.text,
        entity: '',
        entityId: '',
        kind: 'TEXT',
        origin: 'BOT',
        bitrixChatId: input.bitrixChatId,
        originContext: originContext as unknown as OutboxJson,
      },
    ])

    await sequenceOutboxRows(
      { cadence: this.deps.cadence, outbox: this.deps.outbox },
      input.item,
      rows,
    )
    for (const row of rows) {
      await this.deps.sendQueue.enqueue({ outboxId: row.id })
    }
  }
}
