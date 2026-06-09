import type { Provider } from '../types'

export const PROVIDERS: {
  value: Provider
  label: string
  disabled?: boolean
}[] = [
  { value: 'asaas', label: 'Asaas' },
  { value: 'conta_azul', label: 'Conta Azul' },
  { value: 'sonax', label: 'Sonax' },
  { value: 'omie', label: 'Omie (em breve)', disabled: true },
]
