import {
  OpenChannelConversationJob,
  OpenChannelConversationQueue,
} from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import {
  WidgetSendQueue,
  WidgetSendQueueJob,
} from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import {
  enqueueThinkzapWidgetOutboundJob,
  openChannelJobId,
  widgetSendJobId,
} from '@/queue/thinkzap-widget-outbound.queue'

/**
 * Adapter BullMQ do port de abertura de conversa.
 *
 * A única coisa que ele decide é o `jobId` determinístico — o resto é tradução. É o
 * que mantém `enqueueThinkzapWidgetOutboundJob` fora dos use cases de envio, que não
 * têm por que saber que existe Redis.
 */
export class BullMqOpenChannelConversationQueue implements OpenChannelConversationQueue {
  async enqueue(job: OpenChannelConversationJob): Promise<void> {
    await enqueueThinkzapWidgetOutboundJob(
      { kind: 'open-channel', ...job },
      { jobId: openChannelJobId(job.instanceId, job.providerMessageId) },
    )
  }
}

/**
 * Adapter BullMQ do enfileiramento de entrega.
 *
 * `jobId` derivado do id da row: uma intenção, um job. Reenfileirar a mesma intenção —
 * por retry do controller, ou por uma varredura de pendências futura — é colapsado pelo
 * BullMQ em vez de virar duas entregas.
 */
export class BullMqWidgetSendQueue implements WidgetSendQueue {
  async enqueue(job: WidgetSendQueueJob): Promise<void> {
    await enqueueThinkzapWidgetOutboundJob(
      { kind: 'send', outboxId: job.outboxId },
      { jobId: widgetSendJobId(job.outboxId) },
    )
  }
}
