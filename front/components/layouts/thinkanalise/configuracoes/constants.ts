import type { Provider } from '../../types/thinkanalise-types'

export const PROVIDERS: {
  value: Provider
  label: string
  disabled?: boolean
}[] = [
  { value: 'asaas', label: 'Asaas' },
  { value: 'conta_azul', label: 'Conta Azul (em breve)', disabled: true },
  { value: 'omie', label: 'Omie (em breve)', disabled: true },
]
