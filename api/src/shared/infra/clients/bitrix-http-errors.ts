import axios from 'axios'
import { env } from '@/config/env'

export function formatBitrixApiError(
  method: string,
  error: string,
  description?: string,
): string {
  const base = `Bitrix ${method}: ${description ?? error}`
  const lower = `${error} ${description ?? ''}`.toLowerCase()

  if (lower.includes('access_denied') || lower.includes('insufficient_scope')) {
    return `${base}. Verifique scope im no app Bitrix24 e reinstale o app no portal.`
  }

  return base
}

const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
])

export function extractTlsError(method: string, error: unknown): Error | null {
  const cause = (
    axios.isAxiosError(error)
      ? error.cause
      : error instanceof Error
        ? error.cause
        : undefined
  ) as { code?: string } | undefined

  if (cause?.code && TLS_ERROR_CODES.has(cause.code)) {
    const hint = env.bitrix.tlsRejectUnauthorized
      ? 'Verifique HTTPS ao dominio do portal Bitrix no container (nao apenas oauth.bitrix.info).'
      : 'BITRIX_TLS_REJECT_UNAUTHORIZED=false so deve ser usado apenas em dev local.'

    return new Error(
      `Bitrix ${method}: falha na verificacao TLS (${cause.code}). ${hint}`,
    )
  }

  return null
}

export function extractBitrixErrorFromAxios(
  method: string,
  error: unknown,
): Error | null {
  if (!axios.isAxiosError(error) || !error.response?.data) {
    return null
  }

  const data = error.response.data as {
    error?: string
    error_description?: string
  }

  if (!data.error) return null

  return new Error(
    formatBitrixApiError(method, data.error, data.error_description),
  )
}

export function wrapBitrixRequestError(method: string, error: unknown): Error {
  const tlsError = extractTlsError(method, error)
  if (tlsError) return tlsError

  const bitrixError = extractBitrixErrorFromAxios(method, error)
  if (bitrixError) return bitrixError

  return error instanceof Error ? error : new Error(String(error))
}
