import { Instance } from './instance'

export enum ConnectorProvider {
  ZAPI = 'ZAPI',
  HUBMESSAGE = 'HUBMESSAGE',
}

export type Connector = {
  id: string
  instanceId: string
  appId: string
  provider: ConnectorProvider
  instance?: Instance
  createdAt: Date
  updatedAt: Date
}
