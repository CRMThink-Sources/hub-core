import { env } from '@/config/env'
import type { HubMessageStatusEnvelope } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { noopJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { ensureBitrixBotId } from '@/modules/thinkzap/application/ensure-bitrix-bot-id'
import { notifyOperatorDeliveryFailed } from '@/modules/thinkzap/application/notify-operator-delivery-failed'
import { ProcessHubMessageDeliveryStatusUseCase } from '@/modules/thinkzap/application/process-hubmessage-delivery-status.use-case'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { reportSmsMessageStatus } from '@/modules/thinkzap/application/report-sms-message-status'
import { redisConnection } from '@/queue/redis-connection'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'

/**
 * Callback de status da HubMessage: o desfecho, na Meta, da mensagem que o operador
 * enviou pelo canal aberto.
 *
 * O corpo aqui é o do evento `MESSAGE_DELIVERY` — **não** é `HubMessageWebhookMessage`.
 * É por isso que o job tem `source: 'hubmessage-status'` próprio: atrás do mesmo
 * `source` do inbound, o cast do body passaria pelo TypeScript e estouraria em runtime.
 */
export async function processHubMessageDeliveryStatus(
  envelope: HubMessageStatusEnvelope,
  deps: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
): Promise<void> {
  const useCase = new ProcessHubMessageDeliveryStatusUseCase({
    instanceRepo: new PrismaInstanceRepository(),
    messageRepo: new PrismaThinkzapMessageRepository(),
    domainRepo: new PrismaDomainRepository(),
    makeBitrixClient: domainName =>
      makeBitrixClientByDomainAndAppCoode(domainName, thinkzapAppCodeId()),
    /**
     * `env.appCodes.thinkzap` (código de marketplace), não `thinkzapAppCodeId()`: é a
     * chave com que o `botId` já está cacheado no Redis pelo caminho de envio. Passar
     * outra faria este caminho resolver o bot de novo no Bitrix a cada recusa.
     */
    resolveBotId: (client, domainName) =>
      ensureBitrixBotId(
        client,
        redisConnection,
        domainName,
        env.appCodes.thinkzap,
      ),
    notifyOperator: notifyOperatorDeliveryFailed,
    outboxRepo: new PrismaWidgetOutboxRepository(),
    /**
     * `delivered` / `undelivered` na tela de campanha. Só a linha oficial passa por
     * aqui, e é por isso que só ela tem estes dois status — a Z-API não confirma
     * entrega por mensagem no caminho que o ThinkZap usa, e para em `sent`.
     */
    reportSmsStatus: async (row, status) => {
      const domainName =
        (await new PrismaDomainRepository().getDomainById(row.domainId))
          ?.name ?? ''

      await reportSmsMessageStatus(
        await makeBitrixClientByDomainAndAppCoode(domainName, row.appCode),
        {
          senderCode: row.smsSenderCode as string,
          messageId: row.smsMessageId as string,
          status,
        },
      )
    },
  })

  await useCase.execute(envelope, deps)
}
