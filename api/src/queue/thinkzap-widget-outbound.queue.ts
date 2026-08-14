import { Queue } from 'bullmq'
import { redisConnection } from './redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const THINKZAP_WIDGET_OUTBOUND = 'thinkzap-widget-outbound'

/**
 * Fila do **outbound do widget** — separada de `thinkzap-inbound` de propósito.
 *
 * Enfiar trabalho de saída numa fila chamada "inbound" faria o nome mentir e
 * misturaria as métricas de duas coisas com semântica diferente: uma processa evento
 * de terceiro (que pode ser descartado), a outra entrega mensagem de cliente (que
 * não pode).
 *
 * O `Worker` dela, no entanto, roda no **processo que já existe** — um processo
 * consome quantas filas quiser, e isso evita serviço novo no compose para uma
 * mudança de aplicação. Ver `workers/thinkzap-widget-outbound.processor.ts`.
 */
export type ThinkzapOpenChannelJob = {
  kind: 'open-channel'
  /** A linha, pelo id do item de assinatura. Resolve o item em qualquer provider. */
  subscriptionItemId: string
  /** Uuid de `core_domains`. O nome do portal é resolvido no worker. */
  domainId: string
  /** `core_app_codes.id`. */
  appCode: string
  /** `Instance.id` (uuid do banco) — a âncora com que a mensagem foi persistida. */
  instanceId: string
  /** Id da mensagem no provider; a chave da row cujo `chat_id` será gravado. */
  providerMessageId: string
  /** Telefone do destino, já normalizado por quem enfileirou. */
  destination: string
  /** O texto a postar. Em envio só de anexo, o descritivo do tipo. */
  text: string
}

/**
 * Entrega de uma intenção do outbox.
 *
 * O payload é **só o id da row**. Tudo que o envio precisa está no banco, e repetir os
 * dados aqui criaria duas fontes de verdade que divergem no primeiro retry — o job
 * carregaria o texto de quando foi enfileirado enquanto a row carrega o estado atual.
 */
export type ThinkzapWidgetSendJob = {
  kind: 'send'
  outboxId: string
}

/**
 * Discriminado por `kind`: a fila carrega a entrega da mensagem e o efeito colateral
 * dela, que têm ciclos de vida diferentes — a entrega precisa do outbox e da ordem por
 * destino, a abertura de conversa é idempotente e pode rodar em qualquer ordem.
 */
export type ThinkzapWidgetOutboundJob =
  | ThinkzapOpenChannelJob
  | ThinkzapWidgetSendJob

export const thinkzapWidgetOutboundQueue = new Queue<ThinkzapWidgetOutboundJob>(
  THINKZAP_WIDGET_OUTBOUND,
  { connection: redisConnection },
)

/**
 * `jobId` determinístico: reentrega do mesmo efeito é colapsada pelo BullMQ antes de
 * chegar ao worker.
 *
 * A dupla `(instanceId, providerMessageId)` é a mesma chave da row de mensagem, então
 * duas tentativas de abrir a conversa para a mesma mensagem são o mesmo job — não
 * dois jobs concorrendo pelo guard de `chat_id`.
 */
export function openChannelJobId(
  instanceId: string,
  providerMessageId: string,
): string {
  return `widget-open-channel:${instanceId}:${providerMessageId}`
}

/** O id da row do outbox é a chave natural: uma intenção, um job. */
export function widgetSendJobId(outboxId: string): string {
  return `widget-send:${outboxId}`
}

export async function enqueueThinkzapWidgetOutboundJob(
  job: ThinkzapWidgetOutboundJob,
  opts?: { jobId?: string },
) {
  const createdJob = await thinkzapWidgetOutboundQueue.add(
    'process-widget-outbound',
    job,
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      ...(opts?.jobId ? { jobId: opts.jobId } : {}),
    },
  )

  apiLogger.info(
    {
      app: 'thinkzap',
      queue: THINKZAP_WIDGET_OUTBOUND,
      jobId: createdJob.id,
      kind: job.kind,
      ...(job.kind === 'open-channel'
        ? {
            subscriptionItemId: job.subscriptionItemId,
            providerMessageId: job.providerMessageId,
          }
        : { outboxId: job.outboxId }),
    },
    'Widget outbound job enqueued',
  )

  return createdJob
}
