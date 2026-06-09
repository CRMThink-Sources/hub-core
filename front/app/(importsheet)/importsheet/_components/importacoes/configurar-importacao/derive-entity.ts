import type { EntityCode } from '../../types'
import { ENTITIES, type EntityDef } from './constants'

export type EntityFlags = {
  entity: EntityDef | null
  needsPipeline: boolean
  needsSpa: boolean
  isTask: boolean
  isFeed: boolean
  isCrmLike: boolean
  perColumn: boolean
  resolvedEntityTypeId: number | null
  showCreateContact: boolean
  showCreateCompany: boolean
}

export function deriveEntity(
  entityCode: EntityCode | '',
  spaTypeId: number | null,
): EntityFlags {
  const entity = ENTITIES.find(e => e.code === entityCode) ?? null
  const needsPipeline = entity?.hasPipeline ?? false
  const needsSpa = entity?.kind === 'spa'
  const isTask = entity?.kind === 'task'
  const isFeed = entity?.kind === 'feed'
  const isCrmLike = entity?.kind === 'crm' || needsSpa
  const perColumn = isCrmLike || isTask
  const resolvedEntityTypeId = needsSpa
    ? spaTypeId
    : (entity?.entityTypeId ?? null)

  return {
    entity,
    needsPipeline,
    needsSpa,
    isTask,
    isFeed,
    isCrmLike,
    perColumn,
    resolvedEntityTypeId,
    showCreateContact: isCrmLike && entityCode !== 'CONTACT',
    showCreateCompany: isCrmLike && entityCode !== 'COMPANY',
  }
}
