import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { ensureSubscriptionItemConnectedField } from '@/modules/application/infra/bitrix/ensure-subscription-item-connected-field'
import { BitrixLineItemByRemoteIdFinder } from '@/modules/application/infra/bitrix/readers/bitrix-line-item-by-remote-id.finder'
import { SyncLineConnectedField } from '@/modules/thinkzap/application/sync-line-connected-field'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import type { LineConnectedSyncDeps } from '@/workers/thinkzap-line-connected-sync.processor'

/** Portal interno da CRMThink, onde vive a SPA 1146 — mesmo client do repositório. */
const makeInternalBitrix = () =>
  new BitrixClient({ webhook: env.crmthinkWebhookUrl })

export const makeSyncLineConnectedField = (): SyncLineConnectedField => {
  const bitrix = makeInternalBitrix()
  return new SyncLineConnectedField(makeSubscriptionItemRepository(), () =>
    ensureSubscriptionItemConnectedField(bitrix),
  )
}

export const makeLineConnectedSyncDeps = (): LineConnectedSyncDeps => {
  const zApi = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  return {
    finder: new BitrixLineItemByRemoteIdFinder(makeInternalBitrix()),
    sync: makeSyncLineConnectedField(),
    readZApiConnected: async (instanceId, token) =>
      (await zApi.getInstanceStatus(instanceId, token)).connected,
  }
}
