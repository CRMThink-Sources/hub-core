import { env } from '@/config/env'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import {
  listLineItemsForApp,
  providerLineId,
} from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { resolveLegacyLineRows } from './resolve-legacy-line-rows'

export type ThinkzapInstanceItem = {
  /** Id do **item de assinatura** — a chave estável da linha. */
  subscriptionItemId: string
  /** `Connector.id`, só para a rota de reativar. `null` quando não há row. */
  connectorId: string | null
  connectorStatus: string | null
  provider: string
  /** `Instance.id`, chave das rotas de assinar, desassinar e renomear. `null` sem row. */
  instanceDbId: string | null
  /** Id da linha no provider: instância Z-API ou canal HubMessage. */
  instanceId: string
  vinculatedChannel: string | null
  status: string | null
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
  zapiName: string | null
  zapiConnected: boolean | null
  zapiPaymentStatus: string | null
}

export type ListThinkzapInstancesForAppOutput = {
  instances: ThinkzapInstanceItem[]
}

/**
 * Instâncias da instalação para o portal admin.
 *
 * Lista pelos **itens de assinatura**: a linha existe porque o item existe, não
 * porque há row em `core_thinkerszap_instances`. Antes o filtro era
 * `c.instance !== null`, o que sumia com toda linha criada na SPA.
 *
 * As rows antigas continuam sendo resolvidas **por** linha, porque quatro rotas de
 * escrita do admin ainda são keyed por elas — ver `resolveLegacyLineRows`. Linha sem
 * row aparece na lista com esses ids nulos, e a tela esconde as ações
 * correspondentes.
 *
 * A credencial Z-API vem de `metadata`, não de `instance.zApiToken`: é a fonte que a
 * linha declara, e existe mesmo sem row.
 */
export async function listThinkzapInstancesForApp(
  appId: string,
): Promise<ListThinkzapInstancesForAppOutput> {
  const lines = await listLineItemsForApp(appId, {
    getApp: new PrismaInstalledAppRepository(),
    getAplicationContext: makeGetAplicationContext(),
  })

  if (!lines) return { instances: [] }

  const client = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  const instances = await Promise.all(
    lines.items.map(async item => {
      const lineId = providerLineId(item)
      const legacy = await resolveLegacyLineRows(lineId)

      // Só a Z-API expõe leitura de instância; a HubMessage não tem equivalente.
      const zapi =
        item.metadata.provider === 'ZAPI'
          ? await client
              .getInstance(
                item.metadata.zApiInstanceId,
                item.metadata.zApiInstanceToken,
              )
              .catch(() => null)
          : null

      return {
        subscriptionItemId: item.id,
        connectorId: legacy.connectorId,
        connectorStatus: legacy.connectorStatus,
        provider: item.metadata.provider,
        instanceDbId: legacy.instanceDbId,
        instanceId: lineId ?? '',
        vinculatedChannel: item.vinculatedChannel,
        status: legacy.instanceStatus,
        messageUpdateEventEnabled: item.settings.messageUpdateEventEnabled,
        messageDeleteEventEnabled: item.settings.messageDeleteEventEnabled,
        zapiName: zapi?.name ?? null,
        zapiConnected: zapi?.connected ?? null,
        zapiPaymentStatus: zapi?.paymentStatus ?? null,
      }
    }),
  )

  return { instances }
}
