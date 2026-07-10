export type BiAnalyseProvider =
  | 'asaas'
  | 'bling'
  | 'conta_azul'
  | 'omie'
  | 'sonax'

export type BiConnector = {
  id: string
  appId: string
  biconnectorId: number
  label: string
  provider: BiAnalyseProvider
  apiKey: string
  createdAt: Date
  updatedAt: Date
}
