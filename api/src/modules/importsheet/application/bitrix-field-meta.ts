import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { BitrixFieldMeta, StatusLists } from './field-value-transform'

export type FieldMetaResult = {
  metas: Map<string, BitrixFieldMeta>
  statusLists: StatusLists
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

/** Metadados dos campos de uma entidade CRM (crm.item.fields) + status lists. */
export async function loadCrmFieldMeta(
  bitrix: BitrixClient,
  entityTypeId: number,
): Promise<FieldMetaResult> {
  const res = await bitrix.callMethod<FieldsResponse>('crm.item.fields', {
    entityTypeId,
  })
  const metas = toMetas(res.result?.fields ?? {})
  const statusLists = await loadStatusLists(bitrix, metas)
  return { metas, statusLists }
}

/** Metadados dos campos de Tarefa (tasks.task.getFields). */
export async function loadTaskFieldMeta(
  bitrix: BitrixClient,
): Promise<FieldMetaResult> {
  const res = await bitrix.callMethod<FieldsResponse>(
    'tasks.task.getFields',
    {},
  )
  const metas = toMetas(res.result?.fields ?? {})
  const statusLists = await loadStatusLists(bitrix, metas)
  return { metas, statusLists }
}
