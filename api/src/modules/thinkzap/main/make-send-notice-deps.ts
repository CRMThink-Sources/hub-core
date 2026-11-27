import { env } from '@/config/env'
import type { NotifySendFailuresDeps } from '@/modules/thinkzap/application/notify-send-failures'
import {
  openSendNotice,
  type OpenSendNotice,
} from '@/modules/thinkzap/application/open-send-notice'
import { publishSendState } from '@/modules/thinkzap/application/publish-send-state'
import type { RefreshSendCommentDeps } from '@/modules/thinkzap/application/refresh-send-comment'
import { hubMessageConnectorLabel } from '@/modules/thinkzap/domain/hubmessage-connector-label'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import {
  PrismaSendNoticeRepository,
  type SendNoticeRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import {
  PrismaWidgetOutboxRepository,
  type WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { makeTimelineNotifier } from '@/modules/thinkzap/main/make-timeline-notifier'
import { enqueueSendNotice } from '@/queue/thinkzap-send-notices.queue'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'

/** Agenda o aviso de uma row que mudou de estado. Nunca lança. */
export function makePublishSendState(): (outboxId: string) => Promise<void> {
  const deps = {
    outbox: new PrismaWidgetOutboxRepository(),
    notices: new PrismaSendNoticeRepository(),
    enqueue: enqueueSendNotice,
  }

  return outboxId => publishSendState(outboxId, deps)
}

/** Abre o aviso de um disparo dos robôs de template e de botões. Nunca lança. */
export function makeOpenSendNotice(): OpenSendNotice {
  const deps = {
    notices: new PrismaSendNoticeRepository(),
    enqueue: enqueueSendNotice,
  }

  return input => openSendNotice(input, deps)
}

/** Cliente por domínio/app code: no worker não há `req`. Domínio removido = `null`. */
async function bitrixOf(notice: SendNoticeRecord) {
  const domain = await new PrismaDomainRepository().getDomainById(
    notice.domainId,
  )
  if (!domain) return null

  const bitrix = await makeBitrixClientByDomainAndAppCoode(
    domain.name,
    notice.appCode,
  )
  return { bitrix, domainName: domain.name }
}

const localeOf = (notice: SendNoticeRecord) =>
  makeInstallationLocaleRepository().byInstallation(
    notice.domainId,
    notice.appCode,
  )

/**
 * O número da linha que enviou. A instância é achada pelo `instanceId` da row (a chave primária de `Instance`), que
 * na Z-API é a instância e na linha oficial é o canal (as duas colunas guardam o
 * canal). A HubMessage não expõe leitura de canal, então a oficial usa o que está
 * gravado, como o rótulo do conector.
 */
async function lineFromPhone(row: WidgetOutboxRecord): Promise<string> {
  const instance = await new PrismaInstanceRepository().getInstance(
    row.instanceId,
  )
  if (!instance) return ''

  if (instance.zApiToken) {
    const phone = await new ZApiClient(
      env.zApi.partnerToken,
      env.zApi.clientToken,
    ).getPhoneData(instance.instanceId, instance.zApiToken)
    return phone?.phone ?? ''
  }

  return instance.channelId ? hubMessageConnectorLabel(instance) : ''
}

export function makeRefreshSendCommentDeps(): RefreshSendCommentDeps {
  return {
    notices: new PrismaSendNoticeRepository(),
    outbox: new PrismaWidgetOutboxRepository(),
    publisher: async notice => {
      const client = await bitrixOf(notice)
      return client
        ? makeTimelineNotifier(client.bitrix, client.domainName)
        : null
    },
    locale: localeOf,
    fromPhone: lineFromPhone,
    now: () => new Date(),
  }
}

export function makeNotifySendFailuresDeps(): NotifySendFailuresDeps {
  return {
    notices: new PrismaSendNoticeRepository(),
    outbox: new PrismaWidgetOutboxRepository(),
    bitrix: async notice => (await bitrixOf(notice))?.bitrix ?? null,
    locale: localeOf,
    now: () => new Date(),
  }
}
