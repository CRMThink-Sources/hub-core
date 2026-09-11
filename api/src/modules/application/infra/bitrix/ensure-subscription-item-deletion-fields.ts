import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/** Campos da SPA 1146 que registram quando e por quem uma linha foi excluída. */
export const SUBSCRIPTION_ITEM_DELETED_AT_FIELD = 'ufCrm93DeletedAt' as const
export const SUBSCRIPTION_ITEM_DELETED_BY_FIELD = 'ufCrm93DeletedBy' as const

const DELETION_FIELDS = [
  SUBSCRIPTION_ITEM_DELETED_AT_FIELD,
  SUBSCRIPTION_ITEM_DELETED_BY_FIELD,
] as const

export class SubscriptionItemDeletionFieldsMissingError extends Error {
  constructor(missing: readonly string[], entityTypeId: number) {
    super(
      `Campo(s) ${missing.join(', ')} não existe(m) na SPA ${entityTypeId}. ` +
        'Crie-os antes de excluir uma linha — sem eles a auditoria da exclusão ' +
        '(quando e por quem) é perdida em silêncio.',
    )
    this.name = 'SubscriptionItemDeletionFieldsMissingError'
  }
}

/** `true` depois da primeira verificação bem-sucedida — não repete a cada exclusão. */
let checked = false

/**
 * Garante que os dois campos de auditoria da exclusão existem na SPA de itens
 * antes de qualquer escrita.
 *
 * **Por que isso é uma verificação e não uma suposição:** `crm.item.update`
 * aceita campo desconhecido e responde sucesso, descartando o valor. Sem esta
 * checagem, um deploy com os campos faltando excluiria linhas normalmente (o
 * status muda) mas sem nenhum rastro de quando ou por quem — e só apareceria como
 * "os campos de auditoria nunca preenchem", sem erro, sem log.
 *
 * Memoizado por processo: a primeira exclusão depois de um deploy paga a ida à
 * rede; as seguintes não. Uma falha não é memoizada — fica livre para a próxima
 * tentativa reencontrar o campo criado enquanto o processo já estava de pé.
 */
export async function ensureSubscriptionItemDeletionFields(
  bitrix: BitrixClient,
  entityTypeId: number = env.payments.spa.subscriptionItemEntityType,
): Promise<void> {
  if (checked) return

  const response = await bitrix.getCrmItemFields(entityTypeId)
  const fields = response.result?.fields ?? {}

  const missing = DELETION_FIELDS.filter(field => !(field in fields))

  if (missing.length > 0) {
    throw new SubscriptionItemDeletionFieldsMissingError(missing, entityTypeId)
  }

  checked = true
}
