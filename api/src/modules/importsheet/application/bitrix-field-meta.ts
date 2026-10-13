import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'
import { AppError } from '@/shared/domain/errors/app-error'
import { importsheetError, logImportsheetError } from '../errors/catalog'
import type { BitrixFieldMeta, StatusLists } from './field-value-transform'

export type FieldMetaResult = {
  metas: Map<string, BitrixFieldMeta>
  statusLists: StatusLists
}

// Field meta muda raramente; o cache evita um `*.fields` por página.
const FIELD_META_TTL_SECONDS = 10 * 60

type SerializedMeta = {
  metas: [string, BitrixFieldMeta][]
  statusLists: StatusLists
}

function serialize(result: FieldMetaResult): string {
  return JSON.stringify({
    metas: [...result.metas.entries()],
    statusLists: result.statusLists,
  } satisfies SerializedMeta)
}

function deserialize(raw: string): FieldMetaResult {
  const parsed = JSON.parse(raw) as SerializedMeta
  return { metas: new Map(parsed.metas), statusLists: parsed.statusLists }
}

async function cached(
  key: string,
  loader: () => Promise<FieldMetaResult>,
): Promise<FieldMetaResult> {
  try {
    const hit = await redisConnection.get(key)
    if (hit) return deserialize(hit)
  } catch (error) {
    logImportsheetError(
      apiLogger,
      'importsheet.bitrix.field_meta_cache_read_failed',
      {
        app: 'importsheet',
        key,
        err: error,
      },
    )
  }
  let fresh: FieldMetaResult
  try {
    fresh = await loader()
  } catch (error) {
    if (error instanceof AppError) throw error
    throw importsheetError('importsheet.bitrix.field_meta_error', error)
  }
  try {
    await redisConnection.set(
      key,
      serialize(fresh),
      'EX',
      FIELD_META_TTL_SECONDS,
    )
  } catch (error) {
    logImportsheetError(
      apiLogger,
      'importsheet.bitrix.field_meta_cache_write_failed',
      {
        app: 'importsheet',
        key,
        err: error,
      },
    )
  }
  return fresh
}

type RawField = {
  type?: string
  isMultiple?: boolean
  statusType?: string
  items?: { ID: string; VALUE: string }[]
}

type FieldsResponse = {
  result?: { fields?: Record<string, RawField> }
}

type StatusItemsResponse = {
  result?: { STATUS_ID: string; NAME: string }[]
}

type BaseCurrencyResponse = { result?: string }

// Bitrix exige `valor|MOEDA` em campos money; sem a moeda base o valor segue sem sufixo.
async function attachBaseCurrency(
  bitrix: BitrixClient,
  metas: Map<string, BitrixFieldMeta>,
): Promise<void> {
  const hasMoney = [...metas.values()].some(m => m.type === 'money')
  if (!hasMoney) return
  try {
    const res = await bitrix.callMethod<BaseCurrencyResponse>(
      'crm.currency.base.get',
      {},
    )
    const currency = res.result
    if (!currency) return
    for (const meta of metas.values()) {
      if (meta.type === 'money') meta.currency = currency
    }
  } catch (error) {
    logImportsheetError(apiLogger, 'importsheet.bitrix.currency_base_failed', {
      app: 'importsheet',
      err: error,
    })
  }
}

function toMetas(
  fields: Record<string, RawField>,
): Map<string, BitrixFieldMeta> {
  const metas = new Map<string, BitrixFieldMeta>()
  for (const [code, raw] of Object.entries(fields)) {
    metas.set(code, {
      type: raw.type ?? 'string',
      isMultiple: raw.isMultiple ?? false,
      enumItems: raw.items,
      statusType: raw.statusType,
    })
  }
  return metas
}

async function loadStatusLists(
  bitrix: BitrixClient,
  metas: Map<string, BitrixFieldMeta>,
): Promise<StatusLists> {
  const statusTypes = new Set<string>()
  for (const meta of metas.values()) {
    if (meta.type === 'crm_status' && meta.statusType) {
      statusTypes.add(meta.statusType)
    }
  }

  const lists: StatusLists = {}
  for (const statusType of statusTypes) {
    const res = await bitrix.callMethod<StatusItemsResponse>(
      'crm.status.entity.items',
      { entityId: statusType },
    )
    lists[statusType] = res.result ?? []
  }
  return lists
}

export async function loadCrmFieldMeta(
  bitrix: BitrixClient,
  appId: string,
  entityTypeId: number,
): Promise<FieldMetaResult> {
  return cached(
    `importsheet:fieldmeta:${appId}:crm:${entityTypeId}`,
    async () => {
      const res = await bitrix.callMethod<FieldsResponse>('crm.item.fields', {
        entityTypeId,
      })
      const metas = toMetas(res.result?.fields ?? {})
      await attachBaseCurrency(bitrix, metas)
      const statusLists = await loadStatusLists(bitrix, metas)
      return { metas, statusLists }
    },
  )
}

export async function loadTaskFieldMeta(
  bitrix: BitrixClient,
  appId: string,
): Promise<FieldMetaResult> {
  return cached(`importsheet:fieldmeta:${appId}:task`, async () => {
    const res = await bitrix.callMethod<FieldsResponse>(
      'tasks.task.getFields',
      {},
    )
    const metas = toMetas(res.result?.fields ?? {})
    const statusLists = await loadStatusLists(bitrix, metas)
    return { metas, statusLists }
  })
}
