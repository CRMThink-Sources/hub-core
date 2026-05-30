import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import {
  buildCrmDetailPlacementBindParams,
  CRM_DETAIL_PLACEMENTS,
} from './build-crm-detail-placement-bind-params'

describe('buildCrmDetailPlacementBindParams', () => {
  it('builds placement.bind params for all CRM detail tabs', () => {
    const params = buildCrmDetailPlacementBindParams()

    expect(params).toHaveLength(CRM_DETAIL_PLACEMENTS.length)
    expect(params.map(item => item.PLACEMENT)).toEqual([
      ...CRM_DETAIL_PLACEMENTS,
    ])
    expect(params[0]).toMatchObject({
      HANDLER: env.bitrix.placement.url,
      TITLE: env.bitrix.placement.name,
      LANG_ALL: {
        pt: { TITLE: env.bitrix.placement.name },
        en: { TITLE: env.bitrix.placement.name },
        es: { TITLE: env.bitrix.placement.name },
      },
    })
  })
})
