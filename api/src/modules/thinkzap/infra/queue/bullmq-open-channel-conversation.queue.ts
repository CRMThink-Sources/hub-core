import {
  OpenChannelConversationJob,
  OpenChannelConversationQueue,
} from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import {
  WidgetSendQueue,
  WidgetSendQueueJob,
  WidgetSendScheduler,
} from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import {
  enqueueThinkzapWidgetOutboundJob,
  openChannelJobId,
  thinkzapWidgetOutboundQueue,
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
export class BullMqWidgetSendQueue
  implements WidgetSendQueue, WidgetSendScheduler
{
  async enqueue(job: WidgetSendQueueJob): Promise<void> {
    await enqueueThinkzapWidgetOutboundJob(
      { kind: 'send', outboxId: job.outboxId },
      { jobId: widgetSendJobId(job.outboxId) },
    )
  }

  /**
   * Recria o job de uma intenção que ficou sem nenhum agendado. Com o `jobId`
   * determinístico, o `add` de um id que ainda existe (mesmo falho ou concluído) é
   * ignorado pelo BullMQ — por isso o job terminado é removido antes.
   */
  async ensureScheduled(outboxId: string): Promise<boolean> {
    const job = await thinkzapWidgetOutboundQueue.getJob(
      widgetSendJobId(outboxId),
    )
    if (job) {
      if (!needsReschedule(await job.getState())) return false
      await job.remove()
    }
    await this.enqueue({ outboxId })
    return true
  }
}

/** Estados em que o job ainda vai rodar (ou está rodando): nada a recriar. */
const ALIVE_JOB_STATES: ReadonlySet<string> = new Set([
  'waiting',
  'delayed',
  'active',
  'prioritized',
  'waiting-children',
])

export function needsReschedule(state: string): boolean {
  return !ALIVE_JOB_STATES.has(state)
}
