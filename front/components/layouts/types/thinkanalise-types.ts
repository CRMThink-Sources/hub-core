export type Provider = 'asaas' | 'conta_azul' | 'omie'

export type ConnectionStatus = 'conectado' | 'erro' | 'pendente'

export interface Connection {
  id: string
  provider: Provider
  label: string
  apiKey: string
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
