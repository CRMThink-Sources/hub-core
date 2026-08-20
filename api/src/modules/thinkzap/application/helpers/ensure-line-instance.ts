import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  Instance,
  InstanceStatus,
} from '@/modules/thinkzap/domain/entities/instance'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/**
 * Garante que existe row de `Instance` para a linha, criando quando falta.
 *
 * **Por que a tabela sobrevive:** `core_thinkerszap_messages` e
 * `_conversations` têm chave estrangeira para `Instance.id`, e a decisão é não
 * alterar schema de produção — então a tabela não pode sair. Ver a nota de
 * parqueamento em `retire-instance-table`.
 *
 * O que ela **deixou** de ser: fonte de configuração. `settings` e
 * `vinculatedChannel` vivem no item da SPA. A row aqui é âncora de identidade —
 * existe para que mensagem e conversa tenham a que se referir.
 *
 * Isso fecha o buraco de origem: linha criada direto na SPA, com credencial válida,
 * não tinha registro e por isso não persistia mensagem nenhuma. Agora o registro
 * nasce na primeira operação que precisa dele.
 *
 * Idempotente: `Instance.instanceId` é `@unique`, então a corrida entre duas
 * requisições resolve na segunda leitura em vez de duplicar.
 */
export async function ensureLineInstance(
  item: SubscriptionItem,
  domainId: string,
  repository: GetInstanceRepository & CreateInstanceRepository,
): Promise<Instance> {
  if (item.metadata.provider === 'HUBMESSAGE') {
    return ensureHubMessageInstance(item, domainId, repository)
  }

  if (item.metadata.provider !== 'ZAPI') {
    throw new LineProviderNotSupportedError(item.metadata.provider)
  }

  const { zApiInstanceId, zApiInstanceToken } = item.metadata

  const existing = await repository.getInstanceByInstanceId(zApiInstanceId)
  if (existing) return existing

  apiLogger.info(
    {
      app: 'thinkzap',
      instanceId: zApiInstanceId,
      subscriptionItemId: item.id,
    },
    'Criando âncora de instância para linha sem registro',
  )

  try {
    return await repository.create({
      domainId,
      instanceId: zApiInstanceId,
      zApiToken: zApiInstanceToken,
      phoneNumber: null,
      /**
       * A row nasce com o vínculo que o item já declara: o roteamento de mensagem
       * recebida encontra a instância **pelo** canal, então sem isso a linha
       * continuaria sem receber, mesmo com a row criada.
       */
      vinculatedChannel: item.vinculatedChannel,
      /**
       * `CONNECTED` porque a credencial do item só existe se a instância foi
       * provisionada no provider. O estado real de conexão é lido ao vivo da Z-API
       * por `GetLineConnection` — esta coluna não decide nada.
       */
      status: InstanceStatus.CONNECTED,
    })
  } catch (error) {
    /**
     * Corrida: outra requisição criou entre a leitura e a escrita. `instanceId` é
     * `@unique`, então a segunda leitura resolve. Só relança se nem isso achar.
     */
    const raced = await repository.getInstanceByInstanceId(zApiInstanceId)
    if (raced) return raced
    logThinkzapError(
      apiLogger,
      'thinkzap.provisioning.instance_ensure_failed',
      {
        app: 'thinkzap',
        domainId,
        instanceId: zApiInstanceId,
        err: (error as Error).message,
      },
      { level: 'error' },
    )
    throw error
  }
}

/**
 * Âncora de uma linha HubMessage.
 *
 * Chaveada por `channelId`, que é o que o webhook daquele provider entrega — e é
 * por ele que `getInstanceByChannelId` procura no roteamento de entrada.
 *
 * `wabaId` vem do item; `phoneId` **não** — aquele só o fluxo de conexão conhece,
 * e nada no caminho de mensagem o usa. Fica nulo, e `markAsConnected` o preenche
 * quando a conexão acontecer.
 *
 * As colunas `channel_id` e `waba_id` vêm da migration `20260709191216`: sem ela
 * aplicada, HubMessage não funciona de forma alguma, então não há schema a tolerar
 * aqui como no caminho Z-API.
 */
async function ensureHubMessageInstance(
  item: SubscriptionItem,
  domainId: string,
  repository: GetInstanceRepository & CreateInstanceRepository,
): Promise<Instance> {
  if (item.metadata.provider !== 'HUBMESSAGE') {
    throw new LineProviderNotSupportedError(item.metadata.provider)
  }

  const { hubmessageChannelId, wabaId } = item.metadata

  const existing = await repository.getInstanceByChannelId(hubmessageChannelId)
  if (existing) return existing

  apiLogger.info(
    {
      app: 'thinkzap',
      channelId: hubmessageChannelId,
      subscriptionItemId: item.id,
    },
    'Criando âncora de instância para linha HubMessage sem registro',
  )

  try {
    return await repository.create({
      domainId,
      /**
       * `instanceId` é `NOT NULL` e `@unique`. Para HubMessage o identificador do
       * provider é o canal, então ele serve nas duas colunas: `instance_id` mantém
       * a unicidade e `channel_id` é por onde o roteamento procura.
       */
      instanceId: hubmessageChannelId,
      channelId: hubmessageChannelId,
      wabaId,
      zApiToken: null,
      phoneNumber: null,
      vinculatedChannel: item.vinculatedChannel,
      status: InstanceStatus.CONNECTED,
    })
  } catch (error) {
    const raced = await repository.getInstanceByChannelId(hubmessageChannelId)
    if (raced) return raced
    logThinkzapError(
      apiLogger,
      'thinkzap.provisioning.instance_ensure_failed',
      {
        app: 'thinkzap',
        domainId,
        channelId: hubmessageChannelId,
        err: (error as Error).message,
      },
      { level: 'error' },
    )
    throw error
  }
}
