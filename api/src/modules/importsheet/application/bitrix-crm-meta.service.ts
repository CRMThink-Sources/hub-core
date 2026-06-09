import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

export type BitrixEntity = {
  entityTypeId: number
  code?: string
  label: string
  hasCategories?: boolean
  isSpa?: boolean
}

export type BitrixCategory = {
  id: number
  name: string
}

export type BitrixField = {
  name: string
  title: string
  type: string
  isRequired: boolean
  isReadOnly: boolean
}

// Entidades CRM base (entityTypeId fixos do Bitrix24).
const CORE_ENTITIES: BitrixEntity[] = [
  { entityTypeId: 1, code: 'LEAD', label: 'Lead' },
  { entityTypeId: 2, code: 'DEAL', label: 'Negócio', hasCategories: true },
  { entityTypeId: 3, code: 'CONTACT', label: 'Contato' },
  { entityTypeId: 4, code: 'COMPANY', label: 'Empresa' },
]

type TypeListResponse = {
  result?: { types?: { entityTypeId?: number; title?: string }[] }
}

type CategoryListResponse = {
  result?: { categories?: { id?: number; name?: string }[] }
}

type FieldDef = {
  title?: string
  type?: string
  isRequired?: boolean
  isReadOnly?: boolean
}

type ItemFieldsResponse = {
  result?: { fields?: Record<string, FieldDef> }
}

type TaskFieldDef = {
  title?: string | null
  type?: string
  required?: boolean
  primary?: boolean
}

type TaskFieldsResponse = {
  result?: { fields?: Record<string, TaskFieldDef> }
}

// campos para Task.ADD

const WRITABLE_TASK_FIELDS = new Set<string>([
  'TITLE',
  'DESCRIPTION',
  'RESPONSIBLE_ID',
  'CREATED_BY',
  'DEADLINE',
  'DATE_START',
  'START_DATE_PLAN',
  'END_DATE_PLAN',
  'PRIORITY',
  'STATUS',
  'GROUP_ID',
  'STAGE_ID',
  'PARENT_ID',
  'ACCOMPLICES',
  'AUDITORS',
  'TAGS',
  'ALLOW_CHANGE_DEADLINE',
  'ALLOW_TIME_TRACKING',
  'TASK_CONTROL',
  'ADD_IN_REPORT',
  'TIME_ESTIMATE',
])

export class BitrixCrmMetaService {
  constructor(private readonly bitrix: BitrixClient) {}

  async listEntities(): Promise<BitrixEntity[]> {
    const data = await this.bitrix.callMethod<TypeListResponse>(
      'crm.type.list',
      {},
    )
    const spas = (data.result?.types ?? [])
      .filter(t => typeof t.entityTypeId === 'number')
      .map<BitrixEntity>(t => ({
        entityTypeId: t.entityTypeId as number,
        label: t.title ?? `SPA ${t.entityTypeId}`,
        isSpa: true,
      }))
    return [...CORE_ENTITIES, ...spas]
  }

  async listCategories(entityTypeId: number): Promise<BitrixCategory[]> {
    const data = await this.bitrix.callMethod<CategoryListResponse>(
      'crm.category.list',
      { entityTypeId },
    )
    return (data.result?.categories ?? [])
      .filter(c => typeof c.id === 'number')
      .map<BitrixCategory>(c => ({ id: c.id as number, name: c.name ?? '' }))
  }

  async listFields(entityTypeId: number): Promise<BitrixField[]> {
    const data = await this.bitrix.callMethod<ItemFieldsResponse>(
      'crm.item.fields',
      { entityTypeId },
    )
    const fields = data.result?.fields ?? {}
    return Object.entries(fields)
      .map<BitrixField>(([name, def]) => ({
        name,
        title: def.title ?? name,
        type: def.type ?? 'string',
        isRequired: def.isRequired ?? false,
        isReadOnly: def.isReadOnly ?? false,
      }))
      .sort((a, b) => {
        if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1
        return a.title.localeCompare(b.title)
      })
  }

  async listTaskFields(): Promise<BitrixField[]> {
    const data = await this.bitrix.callMethod<TaskFieldsResponse>(
      'tasks.task.getFields',
      {},
    )
    const fields = data.result?.fields ?? {}
    return Object.entries(fields)
      .filter(
        ([name]) => WRITABLE_TASK_FIELDS.has(name) || name.startsWith('UF_'),
      )
      .map<BitrixField>(([name, def]) => ({
        name,
        title: def.title ?? name,
        type: def.type ?? 'string',
        isRequired: def.required ?? false,
        isReadOnly: def.primary ?? false,
      }))
      .sort((a, b) => {
        if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1
        return a.title.localeCompare(b.title)
      })
  }
}
