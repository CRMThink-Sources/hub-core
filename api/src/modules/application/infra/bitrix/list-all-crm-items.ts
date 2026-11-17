import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Todas as páginas de um `crm.item.list`. O Bitrix devolve no máximo 50 por chamada,
 * e ler só a primeira escondia a 51ª linha de uma assinatura — da tela, do roteamento
 * e da contagem que vira quantidade cobrada no gateway.
 */
export async function listAllCrmItems(
  bitrix: Pick<BitrixClient, 'listCrmItems'>,
  entityTypeId: number,
  filter: Record<string, unknown>,
): Promise<unknown[]> {
  const items: unknown[] = []
  let start: number | undefined

  do {
    const response =
      start === undefined
        ? await bitrix.listCrmItems(entityTypeId, filter)
        : await bitrix.listCrmItems(entityTypeId, filter, { start })
    items.push(...(response.result?.items ?? []))
    start = response.next
  } while (start !== undefined)

  return items
}
