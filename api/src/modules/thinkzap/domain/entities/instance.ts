export type Instance = {
  id: string
  domainId: string
  instanceId: string
  vinculatedChannel: string | null
  zApiToken: string | null
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
