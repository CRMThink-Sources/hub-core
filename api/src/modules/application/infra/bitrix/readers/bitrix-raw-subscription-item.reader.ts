import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type {
  RawSubscriptionItem,
  RawSubscriptionItemReader,
} from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'
import { SUBSCRIPTION_ITEM_PROVIDER_FIELD } from '../ensure-subscription-item-provider-field'
import { SUBSCRIPTION_PARENT_FIELD } from '../mappers/subscription-item.mapper'

/**
 * Lê os campos crus de um item da SPA 1146 **sem** passar pelo mapper de domínio.
 *
 * `mapBitrixSpaSubscriptionItemToSubscriptionItem` recusa provider declarado sem
 * credencial: `resolveMetadata` trata isso como incoerência, e está certo — em toda
 * outra leitura é. Só que é exatamente o shape do item que alguém acabou de criar à
 * mão no CRM, que é a entrada do fluxo de provisionamento de linha manual. Usar o
 * mapper ali faria o caso normal desse fluxo chegar como
 * `InvalidBitrixSubscriptionItemError`, e o caso de uso teria que ler a validade do
 * dado a partir da mensagem de um erro de validação.
 *
 * **Não troque este leitor pelo mapper.** A duplicação de leitura da mesma SPA é o
 * custo aceito para manter o mapper estrito para todo mundo, com a tolerância
 * confinada ao único fluxo que precisa dela.
 *
 * O que ele faz de interpretação é o mínimo: normaliza caixa e espaços do provider, e
 * colapsa `null`/`''` das credenciais em ausência. Não inventa default — provider
 * vazio sai vazio, e quem decide o que isso significa é o caso de uso.
 */
export class BitrixRawSubscriptionItemReader implements RawSubscriptionItemReader {
  constructor(private readonly bitrix: BitrixClient) {}

  async getRawSubscriptionItem(
    itemId: string,
  ): Promise<RawSubscriptionItem | null> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      itemId,
    )

    const item = response.result?.item

    // Item apagado entre o evento e a leitura: o Bitrix devolve resultado sem item.
    if (!item) return null

    return {
      id: normalizeId(item.id) ?? itemId,
      provider: normalizeProvider(item[SUBSCRIPTION_ITEM_PROVIDER_FIELD]),
      credentials: {
        ...optional('zApiInstanceId', item.ufCrm93ZApiInstanceId),
        ...optional('zApiInstanceToken', item.ufCrm93ZApiInstanceToken),
        ...optional('hubmessageChannelId', item.ufCrm93HubChanelId),
        ...optional('wabaId', item.ufCrm93HubWabaId),
      },
      subscriptionId: normalizeParent(item[SUBSCRIPTION_PARENT_FIELD]),
    }
  }
}

/**
 * O id do item, ou `null` quando o Bitrix não o devolve num tipo que identifica algo —
 * quem chama cai para o id pedido. `String()` cru viraria `'[object Object]'` num campo
 * inesperado, e isso circularia como id de item.
 */
function normalizeId(raw: unknown): string | null {
  if (typeof raw === 'number') return String(raw)
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()

  return null
}

/**
 * `zapi` e ` HubMessage ` são o valor certo com a caixa errada, não valor
 * desconhecido — a mesma normalização que `bitrixSubscriptionItemProvider` faz antes
 * de comparar. Valor não-texto vira string vazia, que é "não preenchido".
 */
function normalizeProvider(raw: unknown): string {
  if (typeof raw === 'string' || typeof raw === 'number') {
    return String(raw).trim().toUpperCase()
  }

  return ''
}

/**
 * Chave **omitida** quando o campo está vazio, em vez de `''`: string vazia passaria
 * por toda checagem de presença e só falharia na chamada ao provider, longe daqui.
 */
function optional(
  key: string,
  raw: unknown,
): Record<string, string> | Record<string, never> {
  const value = typeof raw === 'string' ? raw.trim() : ''

  return value === '' ? {} : { [key]: value }
}

/** O Bitrix devolve parent como número; `0` e vazio são o mesmo: sem pai. */
function normalizeParent(raw: unknown): string | null {
  if (typeof raw === 'number') return raw > 0 ? String(raw) : null
  if (typeof raw === 'string') {
    const value = raw.trim()
    return value !== '' && value !== '0' ? value : null
  }

  return null
}
