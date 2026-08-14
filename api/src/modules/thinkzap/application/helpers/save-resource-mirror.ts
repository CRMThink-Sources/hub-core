import { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ProvisionedConnectorResource } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Grava o espelho do recurso recém-provisionado, **sem nunca lançar**.
 *
 * Vive num helper porque os fluxos que criam linha são três — trial, linha adicional e
 * item criado à mão —, e uma cópia por fluxo divergiria: no dia em que o valor do espelho
 * mudar, dois dos três continuariam gravando o shape antigo, e o sintoma apareceria só na
 * exclusão daquela linha, meses depois.
 *
 * **A falha é `warn`, não erro.** A ordem de gravidade é clara: linha provisionada sem
 * espelho é degradação recuperável — o backfill a alcança, e o pior caso é a exclusão
 * dela registrar recurso órfão. Derrubar o provisionamento por causa do Redis seria
 * cliente pagando por linha que não recebeu.
 *
 * `channelId` do HubMessage sai de `channelId ?? instanceId` pela mesma razão de
 * `toLineMetadata`: os adapters devolvem o canal num campo e o id principal no outro
 * dependendo do caminho de provisionamento, e o espelho guarda os dois porque é dele que
 * a limpeza monta a referência sem ter o item.
 */
export async function saveResourceMirror(
  mirrors: SpaItemResourceMirrorRepository,
  args: {
    itemId: string
    provider: ConnectorProvider
    resource: Pick<
      ProvisionedConnectorResource,
      'instanceId' | 'zApiToken' | 'channelId'
    >
    /** `parentId1142` do item. Sem ele o espelho não serve à limpeza. */
    subscriptionId: string
    log?: Record<string, unknown>
  },
): Promise<void> {
  const { itemId, provider, resource, subscriptionId } = args

  try {
    if (provider === ConnectorProvider.HUBMESSAGE) {
      const channelId = resource.channelId ?? resource.instanceId

      await mirrors.save(itemId, {
        provider: 'HUBMESSAGE',
        instanceId: channelId,
        channelId,
        subscriptionId,
      })

      return
    }

    await mirrors.save(itemId, {
      provider: 'ZAPI',
      instanceId: resource.instanceId,
      ...(resource.zApiToken ? { zApiToken: resource.zApiToken } : {}),
      subscriptionId,
    })
  } catch (error) {
    apiLogger.warn(
      { app: 'thinkzap', ...args.log, itemId, err: error },
      'Espelho do recurso não gravado — a linha funciona, e a exclusão dela pode deixar recurso órfão',
    )
  }
}
