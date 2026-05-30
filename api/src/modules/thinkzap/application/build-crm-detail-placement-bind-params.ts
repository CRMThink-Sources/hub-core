import { env } from '@/config/env'

export const CRM_DETAIL_PLACEMENTS = [
  'CRM_CONTACT_DETAIL_TAB',
  'CRM_COMPANY_DETAIL_TAB',
  'CRM_DEAL_DETAIL_TAB',
  'CRM_LEAD_DETAIL_TAB',
] as const

export type CrmDetailPlacementBindParams = {
  PLACEMENT: (typeof CRM_DETAIL_PLACEMENTS)[number]
  HANDLER: string
  TITLE: string
  LANG_ALL: Record<string, { TITLE: string }>
}

export function buildCrmDetailPlacementBindParams(): CrmDetailPlacementBindParams[] {
  const handler = env.bitrix.placement.url
  const title = env.bitrix.placement.name

  return CRM_DETAIL_PLACEMENTS.map(placement => ({
    PLACEMENT: placement,
    HANDLER: handler,
    TITLE: title,
    LANG_ALL: {
      pt: { TITLE: title },
      en: { TITLE: title },
      es: { TITLE: title },
    },
  }))
}
