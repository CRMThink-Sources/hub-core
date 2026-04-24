import {
  BITRIX_ENTITY_TYPES,
  BITRIX_SPA_CLIENT_FIELDS,
  STATUS_OPTIONS,
} from '@/shared/domain/config/bitrix.env'
import { Spa } from '@/shared/domain/entities/spa'
import {
  CreateSpaParams,
  CreateSpaRepository,
} from '@/shared/domain/repositories/spa/create-spa.repository'
import { GetSpaRepository } from '@/shared/domain/repositories/spa/get-spa.repository'
import {
  UpdateSpaParams,
  UpdateSpaRepository,
} from '@/shared/domain/repositories/spa/update-spa.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

export class BitrixSpaRepository
  implements GetSpaRepository, CreateSpaRepository, UpdateSpaRepository
{
  constructor(private readonly bitrix: BitrixClient) {}

  async get(params: { appId: string; domain: string }): Promise<Spa | null> {
    const {
      result: { items },
    } = await this.bitrix.listCrmItems(BITRIX_ENTITY_TYPES.SPA_CLIENT, {
      [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: params.appId,
      [BITRIX_SPA_CLIENT_FIELDS.DOMAIN]: params.domain,
    })

    const item = items[0]
    if (!item) return null

    return {
      id: item.id,
      appId: params.appId,
      domain: params.domain,
      memberId: '',
      name: '',
      email: '',
      phone: '',
      company: '',
      trialExpiresAt: null,
      trialCustomerId: null,
      trialSubscriptionId: null,
    }
  }

  async create(params: CreateSpaParams): Promise<Spa> {
    const response = await this.bitrix.createCrmItem(
      BITRIX_ENTITY_TYPES.SPA_CLIENT,
      {
        [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: params.appId,
        [BITRIX_SPA_CLIENT_FIELDS.DOMAIN]: params.domain,
        [BITRIX_SPA_CLIENT_FIELDS.MEMBER_ID]: params.memberId,
        [BITRIX_SPA_CLIENT_FIELDS.NAME]: params.name,
        [BITRIX_SPA_CLIENT_FIELDS.EMAIL]: params.email,
        [BITRIX_SPA_CLIENT_FIELDS.PHONE]: params.phone,
        [BITRIX_SPA_CLIENT_FIELDS.COMPANY]: params.company,
        [BITRIX_SPA_CLIENT_FIELDS.TRIAL_EXPIRES_AT]:
          params.trialExpiresAt ?? null,
        [BITRIX_SPA_CLIENT_FIELDS.TRIAL_CUSTOMER_ID]:
          params.trialCustomerId ?? null,
        [BITRIX_SPA_CLIENT_FIELDS.TRIAL_SUBSCRIPTION_ID]:
          params.trialSubscriptionId ?? null,
        [BITRIX_SPA_CLIENT_FIELDS.STATUS]:
          STATUS_OPTIONS[params.status as keyof typeof STATUS_OPTIONS] ?? null,
      },
    )

    return {
      id: response.result.item.id,
      ...params,
      trialExpiresAt: params.trialExpiresAt ?? null,
      trialCustomerId: params.trialCustomerId ?? null,
      trialSubscriptionId: params.trialSubscriptionId ?? null,
      status: params.status ?? null,
    }
  }

  async update(params: UpdateSpaParams): Promise<Spa> {
    const existing = await this.get({
      appId: params.appId,
      domain: params.domain,
    })

    if (!existing) {
      throw new Error('SPA not found to update')
    }

    const next = {
      ...existing,
      ...params,
    }

    await this.bitrix.updateCrmItem(
      BITRIX_ENTITY_TYPES.SPA_CLIENT,
      existing.id,
      {
        ...(params.name !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.NAME]: params.name,
        }),
        ...(params.email !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.EMAIL]: params.email,
        }),
        ...(params.phone !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.PHONE]: params.phone,
        }),
        ...(params.company !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.COMPANY]: params.company,
        }),
        ...(params.trialExpiresAt !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.TRIAL_EXPIRES_AT]: params.trialExpiresAt,
        }),
        ...(params.trialCustomerId !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.TRIAL_CUSTOMER_ID]: params.trialCustomerId,
        }),
        ...(params.trialSubscriptionId !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.TRIAL_SUBSCRIPTION_ID]:
            params.trialSubscriptionId,
        }),
        ...(params.status !== undefined && {
          [BITRIX_SPA_CLIENT_FIELDS.STATUS]:
            STATUS_OPTIONS[params.status as keyof typeof STATUS_OPTIONS] ??
            null,
        }),
      },
    )

    return next
  }
}
