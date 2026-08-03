import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/** Campo da SPA 1146 que guarda o JSON de `ConnectorSettings`. */
export const SUBSCRIPTION_ITEM_SETTINGS_FIELD = 'ufCrm93Settings' as const

/**
 * Campo da SPA 1146 que guarda o id do canal aberto vinculado.
 *
 * Reaproveitado: existia sem nenhum consumidor no código. O título no Bitrix diz
 * "Conector" por herança do modelo antigo — o que ele guarda é o canal aberto.
 */
export const SUBSCRIPTION_ITEM_CHANNEL_FIELD = 'ufCrm93Conector' as const

export class SubscriptionItemSettingsFieldMissingError extends Error {
  constructor(entityTypeId: number) {
    super(
      `Campo "${SUBSCRIPTION_ITEM_SETTINGS_FIELD}" não existe na SPA ${entityTypeId}. ` +
        'Crie-o antes de gravar ajustes de conector — sem ele toda gravação é perdida em silêncio.',
    )
    this.name = 'SubscriptionItemSettingsFieldMissingError'
  }
}

/**
 * Garante que o campo de settings existe na SPA de itens antes de qualquer
 * escrita.
 *
 * **Por que isso é uma verificação e não uma suposição:** `crm.item.update`
 * aceita campo desconhecido e responde sucesso, descartando o valor. Sem esta
 * checagem, um deploy com o campo faltando gravaria ajustes de cliente no vazio
 * e só apareceria como "o toggle não salva" — sem erro, sem log, sem rastro.
 *
 * Usado pelo backfill, que aborta antes de tocar qualquer item.
 */
export async function ensureSubscriptionItemSettingsField(
  bitrix: BitrixClient,
  entityTypeId: number = env.payments.spa.subscriptionItemEntityType,
): Promise<void> {
  const response = await bitrix.getCrmItemFields(entityTypeId)
  const fields = response.result?.fields ?? {}

  if (!(SUBSCRIPTION_ITEM_SETTINGS_FIELD in fields)) {
    throw new SubscriptionItemSettingsFieldMissingError(entityTypeId)
  }
}
