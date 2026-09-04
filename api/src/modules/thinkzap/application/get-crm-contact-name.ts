import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { GetCrmContactName } from './ensure-widget-open-channel-conversation'

type CrmEntityResult = {
  result?: {
    NAME?: string
    LAST_NAME?: string
    TITLE?: string
  }
}

/**
 * O nome do contato no CRM, para nomear a conversa aberta pelo widget.
 *
 * **Por que consultar em vez de usar o telefone.** O operador abre o widget de dentro de
 * um contato, lead ou negócio — ele sabe com quem está falando, e ver "Maria Souza" na
 * lista de conversas é melhor que ver um número. Antes disso não fazia diferença, porque
 * identidade e nome eram o mesmo valor e o nome era o telefone de qualquer jeito.
 *
 * `crm.<entity>.get` porque `entity` já chega em minúsculas do widget e é o mesmo valor
 * que o comentário de timeline usa (lá em maiúsculas, em `ENTITY_TYPE`).
 *
 * `NAME`/`LAST_NAME` antes de `TITLE`: contato e lead têm nome de pessoa, e é ele que o
 * operador reconhece; negócio só tem título, e aí o título serve.
 */
export function makeGetCrmContactName(
  bitrixClient: Pick<BitrixClient, 'callMethod'>,
): GetCrmContactName {
  return async ({ entity, entityId }) => {
    const id = Number(entityId)
    if (!id || Number.isNaN(id)) return null

    const response = await bitrixClient.callMethod<CrmEntityResult>(
      `crm.${entity.toLowerCase()}.get`,
      { ID: id },
    )

    const found = response?.result
    if (!found) return null

    const person = [found.NAME, found.LAST_NAME]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ')
      .trim()

    return person || found.TITLE?.trim() || null
  }
}
