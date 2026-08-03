import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import {
  listLineItemsForApp,
  providerLineId,
} from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { resolveLegacyLineRows } from './resolve-legacy-line-rows'

export type ThinkzapConnectorItem = {
  /** Id do **item de assinatura** — a mesma chave da tela do tenant. */
  id: string
  /** `Connector.status`; `ACTIVE` quando não há row, que é o caso da linha nascida na SPA. */
  status: string
  /** `Connector.id`, só para a rota de reativar. `null` quando não há row. */
  connectorId: string | null
  /** Id da linha no provider: instância Z-API ou canal HubMessage. */
  instanceId: string
  vinculatedChannel: string | null
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
}

export type ListThinkzapConnectorsOutput = {
  connectors: ThinkzapConnectorItem[]
}

/**
 * Linhas da instalação para o portal admin.
 *
 * Lista pelos **itens de assinatura**, não por `Connector`: aquela tabela não
 * recebe mais row para linha criada na SPA, então o admin via lista vazia para
 * cliente que tinha linha funcionando — sem erro e sem log.
 *
 * `settings` e `vinculatedChannel` já vinham do item; agora a própria existência da
 * linha também. `Connector` virou consulta **por** linha, só para a reativação, que
 * é estado da tabela e não tem equivalente no item.
 */
export async function listThinkzapConnectorsForApp(
  appId: string,
): Promise<ListThinkzapConnectorsOutput> {
  const lines = await listLineItemsForApp(appId, {
    getApp: new PrismaInstalledAppRepository(),
    getAplicationContext: makeGetAplicationContext(),
  })

  if (!lines) return { connectors: [] }

  const connectors = await Promise.all(
    lines.items.map(async item => {
      const lineId = providerLineId(item)
      const legacy = await resolveLegacyLineRows(lineId)

      return {
        id: item.id,
        // Sem row não há conector inativo a reativar: o estado honesto é ativo.
        status: legacy.connectorStatus ?? 'ACTIVE',
        connectorId: legacy.connectorId,
        instanceId: lineId ?? '',
        vinculatedChannel: item.vinculatedChannel,
        messageUpdateEventEnabled: item.settings.messageUpdateEventEnabled,
        messageDeleteEventEnabled: item.settings.messageDeleteEventEnabled,
      }
    }),
  )

  return { connectors }
}
