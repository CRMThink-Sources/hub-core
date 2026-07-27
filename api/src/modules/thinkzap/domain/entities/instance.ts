import { ConnectorSettings } from '../value-objects/connector-settings'

export type Instance = {
  id: string
  domainId: string
  instanceId: string
  vinculatedChannel: string | null
  /** Provider-specific (Z-API). Nulo em conectores HubMessage. */
  zApiToken: string | null
  /** Provider-specific (HubMessage). Nulos em conectores Z-API. */
  channelId: string | null
  webhookId: string | null
  wabaId: string | null
  phoneId: string | null
  settings: ConnectorSettings
  phoneNumber: string | null
  status: InstanceStatus
  createdAt: Date
  updatedAt: Date
}

export enum InstanceStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR',
}
