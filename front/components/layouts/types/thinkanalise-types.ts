export type Provider = 'asaas' | 'conta_azul' | 'omie'

export type ConnectionStatus = 'conectado' | 'erro' | 'pendente'

export interface Connection {
  id: string
  provider: Provider
  label: string
  apiKey: string
  status: ConnectionStatus
}
