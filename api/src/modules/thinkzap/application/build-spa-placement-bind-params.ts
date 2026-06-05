import { env } from '@/config/env'

export type SpaPlacementBindParams = {
  PLACEMENT: string
  HANDLER: string
  TITLE: string
  LANG_ALL: Record<string, { TITLE: string }>
}

export function buildSpaPlacementBindParams(
  entityTypeIds: number[],
): SpaPlacementBindParams[] {
  const handler = env.bitrix.placement.url
  const title = env.bitrix.placement.name

  return entityTypeIds.map(id => ({
    PLACEMENT: `CRM_DYNAMIC_${id}_DETAIL_TAB`,
    HANDLER: handler,
    TITLE: title,
    LANG_ALL: {
      pt: { TITLE: title },
      en: { TITLE: title },
      es: { TITLE: title },
    },
  }))
}
