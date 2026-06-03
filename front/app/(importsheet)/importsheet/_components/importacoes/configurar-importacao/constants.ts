import type { EntityCode, ResponsibleMatchBy, ScheduleType } from '../../types'

export const UNSET = '__unset__'
export const NONE = '__none__'

export type EntityKind = 'crm' | 'spa' | 'task' | 'feed'

export type EntityDef = {
  code: EntityCode
  label: string
  entityTypeId: number | null
  kind: EntityKind
  hasPipeline?: boolean
}

export const ENTITIES: EntityDef[] = [
  { code: 'LEAD', label: 'Lead', entityTypeId: 1, kind: 'crm' },
  {
    code: 'DEAL',
    label: 'Negócio',
    entityTypeId: 2,
    kind: 'crm',
    hasPipeline: true,
  },
  { code: 'CONTACT', label: 'Contato', entityTypeId: 3, kind: 'crm' },
  { code: 'COMPANY', label: 'Empresa', entityTypeId: 4, kind: 'crm' },
  { code: 'SPA', label: 'SPA', entityTypeId: null, kind: 'spa' },
  { code: 'TASK', label: 'Tarefas', entityTypeId: null, kind: 'task' },
  { code: 'FEED', label: 'Livefeed', entityTypeId: null, kind: 'feed' },
]

export const FEED_FIELDS: { code: string; label: string }[] = [
  { code: 'ID', label: 'ID do registro' },
  { code: 'ENTITY', label: 'Entidade (Deal/Company/Lead/Contact)' },
  { code: 'COMMENT', label: 'Comentário' },
]

export const MATCH_OPTIONS: { value: ResponsibleMatchBy; label: string }[] = [
  { value: 'id', label: 'ID' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
]

export const SCHEDULE_OPTIONS: { value: ScheduleType; label: string }[] = [
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias da semana' },
]

export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
]
