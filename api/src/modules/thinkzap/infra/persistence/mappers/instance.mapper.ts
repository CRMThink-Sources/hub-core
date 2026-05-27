import {
  Instance,
  InstanceStatus,
} from '@/modules/thinkzap/domain/entities/instance'
import { parseConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'

type PrismaInstanceRow = {
  id: string
  domainId: string
  instanceId: string
  vinculatedChannel: string | null
  zApiToken: string | null
  settings: unknown
  status: string
  createdAt: Date
  updatedAt: Date
}

export function toInstance(row: PrismaInstanceRow): Instance {
  return {
    id: row.id,
    domainId: row.domainId,
    instanceId: row.instanceId,
    vinculatedChannel: row.vinculatedChannel,
    zApiToken: row.zApiToken,
    settings: parseConnectorSettings(row.settings),
    status: row.status as InstanceStatus,
    phoneNumber: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
