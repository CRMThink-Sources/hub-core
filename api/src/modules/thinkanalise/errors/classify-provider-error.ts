import axios from 'axios'
import { AppError } from '@/shared/domain/errors/app-error'
import { thinkanaliseError } from './catalog'

// Mapeia erro de client de ERP externo → errorCode. Os clients normalizam pra Error
// com mensagens estáveis (ex: 'Invalid credentials', 'rate limit', 'bloqueou').
export function classifyProviderError(error: unknown): AppError {
  if (error instanceof AppError) return error // já classificado (ex: token.*)

  if (axios.isAxiosError(error)) {
    const s = error.response?.status
    if (s === 429)
      return thinkanaliseError('thinkanalise.provider.rate_limited', error)
    if (s === 401 || s === 403)
      return thinkanaliseError('thinkanalise.credentials.invalid', error)
    return thinkanaliseError('thinkanalise.provider.data_fetch_failed', error)
  }

  const msg = error instanceof Error ? error.message : String(error)
  if (msg === 'Invalid credentials')
    return thinkanaliseError('thinkanalise.credentials.invalid', error)
  if (/rate limit|limitou o consumo/i.test(msg))
    return thinkanaliseError('thinkanalise.provider.rate_limited', error)
  if (/bloque|consumo indevido/i.test(msg))
    return thinkanaliseError('thinkanalise.provider.blocked', error)
  return thinkanaliseError('thinkanalise.provider.data_fetch_failed', error)
}
