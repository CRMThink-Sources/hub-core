export type Provider = 'asaas' | 'conta_azul'

export type ConfigStatus = 'conectado' | 'erro' | 'pendente'

export type Config = {
  id: string
  provider: Provider
  label: string
  apiKey: string
  syncFreq: number // minutos
  manualExec?: string // datetime-local string
  status: ConfigStatus
}
