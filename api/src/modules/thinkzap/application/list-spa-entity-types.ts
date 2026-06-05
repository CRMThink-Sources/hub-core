import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

const PAGE_SIZE = 50

type CrmTypeListResult = {
  types?: Array<{ entityTypeId?: number; [key: string]: unknown }>
}

export async function listSpaEntityTypes(
  client: BitrixRestClient,
): Promise<number[]> {
  const ids: number[] = []
  let start = 0

  while (true) {
    const result = (await client.callMethod('crm.type.list', {
      start,
    })) as CrmTypeListResult

    const types = result?.types ?? []

    for (const type of types) {
      if (typeof type.entityTypeId === 'number') {
        ids.push(type.entityTypeId)
      }
    }

    if (types.length < PAGE_SIZE) break

    start += PAGE_SIZE
  }

  return ids
}
