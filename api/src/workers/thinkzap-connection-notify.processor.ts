import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { ThinkzapConnectionNotifyRecipientsService } from '@/modules/thinkzap/application/thinkzap-connection-notify-recipients.service'
import { PrismaConnectionNotifyRecipientRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-connection-notify-recipient.repository'
import { BitrixSystemNotificationService } from '@/shared/application/bitrix-system-notification.service'
import { apiLogger } from '@/shared/infra/logger'
import { AppendJobLog, noopJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import type { ThinkzapConnectionEventJob } from '@/queue/thinkzap-connection-events.queue'

function buildMessage(job: ThinkzapConnectionEventJob): string {
  const target = job.phone ? `WhatsApp ${job.phone}` : `WhatsApp do Thinkzap`

  if (job.type === 'connected') {
    return `O ${target} (instância ${job.instanceId}) foi conectado com sucesso.`
  }

  return job.error
    ? `O ${target} (instância ${job.instanceId}) foi desconectado: ${job.error}. Reconecte o quanto antes.`
    : `O ${target} (instância ${job.instanceId}) foi desconectado. Reconecte o quanto antes.`
}

export type ProcessConnectionEventOutcome =
  | { outcome: 'no-recipients' | 'context-not-found' }
  | { outcome: 'notified'; recipients: number; sent: number }

/**
 * Resolve a instância → domínio → app dona do evento e avisa, no chat interno do
 * Bitrix, cada `bitrixUserId` configurado (mesma lista para conexão e desconexão).
 *
 * Estados "não encontrado" (instância/domínio/app órfãos, sem destinatário
 * configurado) são terminais — logam e retornam, sem lançar. Falha ao montar o client
 * Bitrix ou ao chamar a API **lança**: rodando numa fila, a retentativa automática do
 * BullMQ (`attempts`/`backoff` na própria fila) é estritamente melhor que engolir o
 * erro — o que o handler síncrono antigo fazia por não ter outra saída.
 */
export async function processConnectionEventJob(
  job: ThinkzapConnectionEventJob,
  context: { appendJobLog?: AppendJobLog } = {},
): Promise<ProcessConnectionEventOutcome> {
  const appendJobLog = context.appendJobLog ?? noopJobLog
  const logContext = {
    app: 'thinkzap',
    source: 'z-api',
    type: job.type,
    instanceId: job.instanceId,
  }

  const instance = await new PrismaInstanceRepository().getInstanceByInstanceId(
    job.instanceId,
  )
  if (!instance) {
    await appendJobLog('Instância não encontrada; aviso não enviado')
    apiLogger.debug(logContext, 'Instância do evento de conexão não encontrada')
    return { outcome: 'context-not-found' }
  }

  const domain = await new PrismaDomainRepository().getDomainById(
    instance.domainId,
  )
  if (!domain) {
    await appendJobLog('Portal da instância não encontrado; aviso não enviado')
    apiLogger.debug(
      { ...logContext, domainId: instance.domainId },
      'Portal da instância não encontrado',
    )
    return { outcome: 'context-not-found' }
  }

  const app = await new PrismaInstalledAppRepository().getByAppCodeAndDomainId(
    thinkzapAppCodeId(),
    instance.domainId,
  )
  if (!app) {
    await appendJobLog('App do Thinkzap não encontrado para o portal; aviso não enviado')
    apiLogger.debug(
      { ...logContext, domainId: instance.domainId },
      'App do Thinkzap não encontrado para o portal',
    )
    return { outcome: 'context-not-found' }
  }

  const notifyService = new ThinkzapConnectionNotifyRecipientsService(
    new PrismaConnectionNotifyRecipientRepository(),
    app.id,
  )
  const userIds = await notifyService.get()
  if (userIds.length === 0) {
    await appendJobLog('Nenhum destinatário configurado; aviso não enviado')
    apiLogger.info(
      { ...logContext, appId: app.id },
      'Nenhum destinatário configurado para o aviso de conexão/desconexão',
    )
    return { outcome: 'no-recipients' }
  }

  // Falhas daqui pra baixo (client Bitrix, chamada à API) propagam de propósito — ver
  // docstring da função.
  const bitrix = await makeBitrixClientByDomainAndAppCoode(
    domain.name,
    thinkzapAppCodeId(),
  )
  const notifier = new BitrixSystemNotificationService(bitrix)
  const message = buildMessage(job)

  const results = await Promise.allSettled(
    userIds.map(userId =>
      notifier.notify({ userId, message, tag: `thinkzap:connection:${job.type}` }),
    ),
  )
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length

  await appendJobLog(
    `Aviso processado | destinatários=${userIds.length} | enviados=${sent}`,
  )
  apiLogger.info(
    { ...logContext, recipients: userIds.length, sent },
    'Aviso de conexão/desconexão Z-API processado',
  )

  return { outcome: 'notified', recipients: userIds.length, sent }
}
