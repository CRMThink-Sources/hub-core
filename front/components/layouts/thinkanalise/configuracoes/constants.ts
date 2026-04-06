import { Provider } from '../../types/thinkanalise-types'

export const PROVIDERS: {
  value: Provider
  label: string
  disabled?: boolean
}[] = [
  { value: 'asaas', label: 'Asaas' },
  { value: 'conta_azul', label: 'Conta Azul (em breve)', disabled: true },
]

export const DEFAULT_SYNC_FREQ = 60 // minutos

export function nextSyncTime(freqMin: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + freqMin)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function defaultDatetime(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1)
  return d.toISOString().slice(0, 16)
}
