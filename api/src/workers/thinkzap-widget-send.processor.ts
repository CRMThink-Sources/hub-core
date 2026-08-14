import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { DispatchWidgetOutboxMessage } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import type { DispatchLineTarget } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import { notifyWidgetSendOutcome } from '@/modules/thinkzap/application/notify-widget-send-outcome'
import { findItemInContext } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { BullMqOpenChannelConversationQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import { acquireDestinationLock } from '@/modules/thinkzap/infra/queue/destination-send-lock'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { makeOutboundSenderResolver } from '@/modules/thinkzap/main/make-outbound-sender-resolver'
import { ThinkzapWidgetSendJob } from '@/queue/thinkzap-widget-outbound.queue'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')

export type WidgetSendJobOutcome = 'done' | 'reschedule'

/**
 * Entrega uma mensagem do widget que está no outbox.
 *
 * O processor só **resolve o contexto** e traduz o desfecho; a regra de entrega vive em
 * `DispatchWidgetOutboxMessage`, para ser testável sem Redis, sem Prisma e sem Bitrix.
 *
 * Devolve `reschedule` quando o destino está ocupado — o chamador move o job para
 * atrasado **sem gastar tentativa**. Gastar tentativa por contenção esgotaria as três
 * retentativas numa conversa movimentada e marcaria como falha um envio que nunca foi
 * tentado.
 */
export async function processWidgetSendJob(
  job: ThinkzapWidgetSendJob,
  context: { isLastAttempt: boolean },
): Promise<WidgetSendJobOutcome> {
  const outbox = new PrismaWidgetOutboxRepository()

  const row = await outbox.findById(job.outboxId)
  if (!row) {
    log.warn(
      { app: 'thinkzap', outboxId: job.outboxId },
      'Intenção de envio não encontrada; job descartado',
    )
    return 'done'
  }

  const line = await resolveLineTarget(row)
  if (!line) {
    /**
     * Sem linha resolvível não há o que tentar, e retentar não resolve: o item saiu da
     * instalação ou o portal foi apagado. Estado terminal com aviso ao operador, e não
     * job falho que o BullMQ vai reprocessar três vezes para chegar no mesmo lugar.
     */
    await outbox.markFailed(row.id, 'Linha não encontrada na instalação')
    await notifyOutcomeFor(row, 'failed')
    return 'done'
  }

  const dispatch = new DispatchWidgetOutboxMessage({
    outbox,
    senderResolver: makeOutboundSenderResolver(),
    messages: new PrismaThinkzapMessageRepository(),
    openChannelQueue: new BullMqOpenChannelConversationQueue(),
    acquireLock: (instanceId, destination) =>
      acquireDestinationLock(redisConnection, instanceId, destination),
    notifyOutcome: (outcome, record) => notifyOutcomeFor(record, outcome),
    notifySent: record => notifySentFor(record),
  })

  const result = await dispatch.execute({
    outboxId: row.id,
    line,
    isLastAttempt: context.isLastAttempt,
  })

  log.info(
    {
      app: 'thinkzap',
      outboxId: row.id,
      subscriptionItemId: row.subscriptionItemId,
      dispatchStatus: result.status,
    },
    'Job de envio do widget processado',
  )

  return result.status === 'locked' ? 'reschedule' : 'done'
}

/**
 * A credencial da linha, do item da SPA — **relida a cada execução**, não guardada no
 * job. Uma linha reprovisionada entre o clique e a retentativa passa a valer com a
 * credencial nova.
 */
async function resolveLineTarget(
  row: WidgetOutboxRecord,
): Promise<DispatchLineTarget | null> {
  try {
    const context = await makeGetAplicationContext().execute({
      domainId: row.domainId,
      appCode: row.appCode,
    })

    const item = findItemInContext(context, row.subscriptionItemId)

    if (item.metadata.provider === 'ZAPI') {
      return {
        provider: ConnectorProvider.ZAPI,
        instanceId: item.metadata.zApiInstanceId,
        zApiToken: item.metadata.zApiInstanceToken,
      }
    }

    if (item.metadata.provider === 'HUBMESSAGE') {
      return {
        provider: ConnectorProvider.HUBMESSAGE,
        instanceId: item.metadata.hubmessageChannelId,
        channelId: item.metadata.hubmessageChannelId,
      }
    }

    return null
  } catch (err) {
    log.warn(
      {
        app: 'thinkzap',
        outboxId: row.id,
        subscriptionItemId: row.subscriptionItemId,
        err,
      },
      'Não foi possível resolver a linha da intenção de envio',
    )
    return null
  }
}

/**
 * O cliente Bitrix nasce por domínio e app code — no worker não existe `req`, e
 * `makeBitrixClient(req)` não serve aqui.
 */
async function makeNotifier(row: WidgetOutboxRecord) {
  const domain = await new PrismaDomainRepository().getDomainById(row.domainId)
  if (!domain) return null

  const bitrix = await makeBitrixClientByDomainAndAppCoode(
    domain.name,
    row.appCode,
  )

  return new BitrixLivefeedNotificationService(bitrix)
}

async function notifyOutcomeFor(
  row: WidgetOutboxRecord,
  outcome: 'failed' | 'unknown',
): Promise<void> {
  try {
    const notifier = await makeNotifier(row)
    if (!notifier) return

    await notifyWidgetSendOutcome(notifier, {
      outcome,
      entity: row.entity,
      entityId: row.entityId,
      destination: row.destination,
      text: row.text,
    })
  } catch (err) {
    log.warn(
      { app: 'thinkzap', outboxId: row.id, outcome, err },
      'Falha ao montar o cliente Bitrix para avisar o operador',
    )
  }
}

/** O comentário de timeline do envio bem-sucedido, com o mesmo texto de antes. */
async function notifySentFor(row: WidgetOutboxRecord): Promise<void> {
  try {
    const notifier = await makeNotifier(row)
    if (!notifier) return

    await notifier.execute({
      contextId: row.entityId,
      entity: row.entity,
      message: `Para: ${row.destination}\nMensagem: ${row.text}`,
    })
  } catch (err) {
    log.warn(
      { app: 'thinkzap', outboxId: row.id, err },
      'Falha ao publicar o comentário de timeline do envio',
    )
  }
}
