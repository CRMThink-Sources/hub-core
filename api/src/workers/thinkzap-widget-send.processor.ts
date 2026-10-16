import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { DispatchWidgetOutboxMessage } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import {
  describePrefixUnresolved,
  prepareOpenLineOutboundText,
} from '@/modules/thinkzap/application/prepare-open-line-outbound-text'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'
import type { DispatchLineTarget } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import {
  notifyWidgetSendOutcome,
  WidgetSendOutcome,
} from '@/modules/thinkzap/application/notify-widget-send-outcome'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { reportSmsMessageStatus } from '@/modules/thinkzap/application/report-sms-message-status'
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
import { makeInteractiveButtonSenderResolver } from '@/modules/thinkzap/main/connector/make-interactive-button-sender-resolver'
import { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { ThinkzapWidgetSendJob } from '@/queue/thinkzap-widget-outbound.queue'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

const log = createWorkerSourceLogger('bitrix')

export type WidgetSendJobOutcome = 'done' | 'reschedule'

// `reschedule` (destino ocupado) adia sem gastar tentativa: contenção não é falha de envio.
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

  // `attempts` é da intenção, não do job: a row sobrevive ao job.
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

  await appendJobLog(
    `Intenção ${row.id} | tipo=${row.kind}` +
      (row.kind === 'TEMPLATE' ? ` (${row.templateName})` : '') +
      (row.kind === 'INTERACTIVE_BUTTON'
        ? ` (${row.buttonPayload?.buttons.length ?? 0} botões)`
        : '') +
      ` | status=${row.status} | destino=${row.destination} | ` +
      `jáEntregue=${row.providerMessageId !== null} | tentativasDaIntenção=${row.attempts}` +
      (context.isLastAttempt ? ' | ÚLTIMA TENTATIVA' : ''),
  )

  const line = await resolveLineTarget(row)
  if (!line) {
    // Terminal: retentar não traz a linha de volta.
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
    interactiveButtonSenderResolver: makeInteractiveButtonSenderResolver(),
    messages: new PrismaThinkzapMessageRepository(),
    openChannelQueue: new BullMqOpenChannelConversationQueue(),
    acquireLock: (instanceId, destination) =>
      acquireDestinationLock(redisConnection, instanceId, destination),
    quota: makeDailySendQuota(),
    notifyOutcome: (outcome, record) => notifyOutcomeFor(record, outcome),
    notifySent: record => notifySentFor(record),
    // Só rows de campanha chegam aqui (o despacho filtra pelas âncoras).
    reportSmsStatus: async (record, status) => {
      const domainName =
        (await new PrismaDomainRepository().getDomainById(record.domainId))
          ?.name ?? ''

      const bitrix = await makeBitrixClientByDomainAndAppCoode(
        domainName,
        record.appCode,
      )

      await reportSmsMessageStatus(bitrix, {
        senderCode: record.smsSenderCode as string,
        messageId: record.smsMessageId as string,
        status,
      })
    },
    appendJobLog,
    // Mesmo preparo do canal aberto, para "Prefixar nome do operador" valer no widget.
    prepareOutboundText: async input => {
      const bitrix = await makeBitrixClientByDomainAndAppCoode(
        (await new PrismaDomainRepository().getDomainById(row.domainId))
          ?.name ?? '',
        row.appCode,
      )

      return prepareOpenLineOutboundText({
        ...input,
        getBitrixUserDisplayName: new BitrixGetUserDisplayNameAdapter(bitrix),
        getAllowedUser: new PrismaAllowedUserRepository(),
        onPrefixUnresolved: info =>
          appendJobLog(describePrefixUnresolved(info)),
      })
    },
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

// Relida a cada execução, não guardada no job: linha reprovisionada vale na retentativa.
async function resolveLineTarget(
  row: WidgetOutboxRecord,
): Promise<DispatchLineTarget | null> {
  try {
    const context = await makeGetAplicationContext().execute({
      domainId: row.domainId,
      appCode: row.appCode,
    })

    const item = findItemInContext(context, row.subscriptionItemId)

    const line = { settings: item.settings, appId: context.aplication.id }

    if (item.metadata.provider === 'ZAPI') {
      return {
        ...line,
        provider: ConnectorProvider.ZAPI,
        instanceId: item.metadata.zApiInstanceId,
        zApiToken: item.metadata.zApiInstanceToken,
      }
    }

    if (item.metadata.provider === 'HUBMESSAGE') {
      return {
        ...line,
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

// Cliente por domínio/app code: no worker não há `req`.
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
  outcome: WidgetSendOutcome,
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
      // Só o aviso de limite é traduzido: lê o idioma só quando vai usá-lo.
      ...(outcome === 'daily-limit' && {
        locale: await makeInstallationLocaleRepository().byInstallation(
          row.domainId,
          row.appCode,
        ),
      }),
    })
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.message.widget_send_notice_failed',
      { app: 'thinkzap', outboxId: row.id, outcome, err },
      { msg: 'Falha ao montar o cliente Bitrix para avisar o operador' },
    )
  }
}

// A linha `Template:` é por onde o cliente concilia o que a Meta cobrou — não remover.
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
    logThinkzapError(
      log,
      'thinkzap.message.widget_send_notice_failed',
      { app: 'thinkzap', outboxId: row.id, err },
      { msg: 'Falha ao publicar o comentário de timeline do envio' },
    )
  }
}
