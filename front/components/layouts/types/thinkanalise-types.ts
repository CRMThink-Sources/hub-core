export type Provider = 'asaas' | 'conta_azul' | 'omie' | 'sonax'

export type ConnectionStatus = 'conectado' | 'erro' | 'pendente'

export interface Connection {
  id: string
  provider: Provider
  label: string
  status: ConnectionStatus
  biconnectorId?: number
}

export interface BiConnector {
  id: string
  appId: string
  biconnectorId: number
  label: string
  provider: Provider
  apiKey: string
  createdAt: string
  updatedAt: string
}

export type SourceSettings = Record<string, string>

export interface Source {
  id: number
  connectorId: number
  title: string
  active: boolean
  settings: SourceSettings
}

export interface DatasetField {
  name: string
  type: string
  externalCode: string
  visible: boolean
}

export interface Dataset {
  id: number
  sourceId: number
  name: string
  description?: string
  externalCode: string
  externalName?: string
  fields?: DatasetField[]
}
