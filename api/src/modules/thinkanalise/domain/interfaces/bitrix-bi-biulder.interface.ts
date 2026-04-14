export type Provider = 'asaas' | 'conta_azul' | 'omie'

export type ConnectionStatus = 'conectado' | 'erro' | 'pendente'

export interface SettingsField {
  code: string
  name: string
  type: 'STRING' | 'password'
}

export interface IntegrationMeta {
  code: Provider
  label: string
  fields: SettingsField[]
}

export interface BitrixConnector {
  id: number
  title: string
  dateCreate: string
  urlCheck: string
  urlData: string
  urlTableList: string
  urlTableDescription: string
  settings: SettingsField[]
}

export type SourceSettings = Record<string, string>

export interface BitrixSource {
  id: number
  connectorId: number
  title: string
  active: boolean
  settings: SourceSettings
}

export interface CreateConnectorPayload {
  provider: Provider
  label: string
  apiKey: string
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}
