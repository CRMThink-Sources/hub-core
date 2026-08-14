import { RawSubscriptionItem } from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'
import { ProviderResourceRef } from '../provider-resource-billing'

/**
 * A credencial do recurso a partir do item **cru** da SPA 1146, ou `null` quando não há
 * recurso identificável.
 *
 * `null` cobre quatro casos que levam ao mesmo lugar: provider vazio, provider
 * desconhecido, `NONE`, e provider declarado **sem** a credencial daquele provider — o
 * item recém-criado à mão, que é legal na SPA e ilegal para o domínio. Nenhum deles tem
 * recurso remoto para assinar, desassinar ou espelhar.
 *
 * Credencial **cruzada** (provider `HUBMESSAGE` com campos da Z-API preenchidos) também
 * sai `null`: o leitor cru entrega o que está lá sem julgar, e aqui o provider declarado é
 * quem manda. Aceitar a credencial do outro provider chamaria o adapter errado.
 *
 * Existe como função pura, e fora do caso de uso, porque três caminhos precisam da mesma
 * tradução: a sincronização de status, o backfill do espelho, e o teste dos dois.
 */
export function resolveRawItemResource(
  item: Pick<RawSubscriptionItem, 'provider' | 'credentials'>,
): ProviderResourceRef | null {
  const { credentials } = item

  if (item.provider === 'ZAPI') {
    if (!credentials.zApiInstanceId || !credentials.zApiInstanceToken) {
      return null
    }

    return {
      provider: 'ZAPI',
      instanceId: credentials.zApiInstanceId,
      zApiToken: credentials.zApiInstanceToken,
    }
  }

  if (item.provider === 'HUBMESSAGE') {
    if (!credentials.hubmessageChannelId) return null

    return {
      provider: 'HUBMESSAGE',
      instanceId: credentials.hubmessageChannelId,
      channelId: credentials.hubmessageChannelId,
    }
  }

  return null
}
