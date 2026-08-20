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
import { makeTemplateSenderResolver } from '@/modules/thinkzap/main/connector/make-template-sender-resolver'
import { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
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
  context: { isLastAttempt: boolean; appendJobLog: AppendJobLog },
): Promise<WidgetSendJobOutcome> {
  const { appendJobLog } = context
  const outbox = new PrismaWidgetOutboxRepository()

  const row = await outbox.findById(job.outboxId)
  if (!row) {
    log.warn(
      { app: 'thinkzap', outboxId: job.outboxId },
      'Intenção de envio não encontrada; job descartado',
    )
    await appendJobLog(
      `Intenção ${job.outboxId} não encontrada no banco. Nada a enviar — job descartado.`,
    )
    return 'done'
  }

  /**
   * O estado da intenção **antes** de qualquer coisa acontecer com ela.
   *
   * É a linha que responde "esta execução ia enviar ou ia retomar?" — sem ela, um
   * `resumed` no fim parece um envio que aconteceu, e um `unknown` parece decisão
   * arbitrária. `attempts` e `lastError` mostram o histórico da intenção, que é
   * independente do `attemptsMade` do job: a row sobrevive ao job.
   */
  log.info(
    {
      app: 'thinkzap',
      outboxId: row.id,
      subscriptionItemId: row.subscriptionItemId,
      destination: row.destination,
      outboxKind: row.kind,
      templateName: row.templateName,
      outboxStatus: row.status,
      alreadyDelivered: row.providerMessageId !== null,
      outboxAttempts: row.attempts,
      lastError: row.lastError,
      isLastAttempt: context.isLastAttempt,
    },
    'Despachando intenção de envio do widget',
  )

  /**
   * A primeira linha da aba Logs é a que enquadra tudo que vem depois: quem lê precisa
   * saber, antes de qualquer coisa, se esta execução ia **enviar** ou apenas **retomar**
   * efeitos colaterais de um envio que já aconteceu.
   */
  await appendJobLog(
    `Intenção ${row.id} | tipo=${row.kind}` +
      (row.kind === 'TEMPLATE' ? ` (${row.templateName})` : '') +
      ` | status=${row.status} | destino=${row.destination} | ` +
      `jáEntregue=${row.providerMessageId !== null} | tentativasDaIntenção=${row.attempts}` +
      (context.isLastAttempt ? ' | ÚLTIMA TENTATIVA' : ''),
  )

  const line = await resolveLineTarget(row)
  if (!line) {
    /**
     * Sem linha resolvível não há o que tentar, e retentar não resolve: o item saiu da
     * instalação ou o portal foi apagado. Estado terminal com aviso ao operador, e não
     * job falho que o BullMQ vai reprocessar três vezes para chegar no mesmo lugar.
     */
    await appendJobLog(
      `Linha ${row.subscriptionItemId} não está mais na instalação. ` +
        'Estado terminal (FAILED) — retentativa não resolveria. Operador avisado na timeline.',
    )
    await outbox.markFailed(row.id, 'Linha não encontrada na instalação')
    await notifyOutcomeFor(row, 'failed')
    return 'done'
  }

  await appendJobLog(
    `Linha resolvida: provider=${line.provider} | instância=${line.instanceId}`,
  )

  const dispatch = new DispatchWidgetOutboxMessage({
    outbox,
    senderResolver: makeOutboundSenderResolver(),
    templateSenderResolver: makeTemplateSenderResolver(),
    messages: new PrismaThinkzapMessageRepository(),
    openChannelQueue: new BullMqOpenChannelConversationQueue(),
    acquireLock: (instanceId, destination) =>
      acquireDestinationLock(redisConnection, instanceId, destination),
    notifyOutcome: (outcome, record) => notifyOutcomeFor(record, outcome),
    notifySent: record => notifySentFor(record),
    appendJobLog,
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

  await appendJobLog(`Desfecho: ${describeOutcome(result.status)}`)

  return result.status === 'locked' ? 'reschedule' : 'done'
}

/**
 * Traduz o desfecho do despacho para quem está lendo a aba Logs do job.
 *
 * O código do desfecho sozinho engana: `resumed` parece envio que aconteceu agora, e
 * `skipped` parece que o trabalho foi ignorado por engano. A frase diz o que de fato
 * aconteceu com a mensagem do cliente.
 */
function describeOutcome(status: string): string {
  const descriptions: Record<string, string> = {
    sent: 'ENTREGUE ao contato nesta execução.',
    resumed:
      'Já estava entregue — o provider NÃO foi chamado de novo; só os efeitos colaterais foram retomados.',
    locked:
      'Destino ocupado por outro envio. Reagendado sem gastar tentativa, para preservar a ordem das mensagens.',
    failed:
      'NÃO entregue e não será reenviado automaticamente. Operador avisado na timeline.',
    unknown:
      'INDETERMINADO — não foi possível confirmar se saiu. Não é reenviado de propósito: reenviar arriscaria mensagem duplicada no WhatsApp do contato.',
  }

  return descriptions[status] ?? status
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

/**
 * O comentário de timeline do envio bem-sucedido, com o mesmo texto de antes — e o de
 * template continua nomeando o template.
 *
 * A linha `Template:` não é decoração: o corpo resolvido sozinho não diz qual versão
 * aprovada saiu, e é por ela que o cliente concilia o que a Meta cobrou. Perder essa
 * linha ao mover o envio para o worker seria uma regressão silenciosa no único registro
 * que o operador enxerga.
 */
async function notifySentFor(row: WidgetOutboxRecord): Promise<void> {
  try {
    const notifier = await makeNotifier(row)
    if (!notifier) return

    const templateLine =
      row.kind === 'TEMPLATE' ? `\nTemplate: ${row.templateName}` : ''

    await notifier.execute({
      contextId: row.entityId,
      entity: row.entity,
      message: `Para: ${row.destination}${templateLine}\nMensagem: ${row.text}`,
    })
  } catch (err) {
    log.warn(
      { app: 'thinkzap', outboxId: row.id, err },
      'Falha ao publicar o comentário de timeline do envio',
    )
  }
}
