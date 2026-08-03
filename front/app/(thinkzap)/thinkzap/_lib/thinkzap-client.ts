import axios from 'axios'

import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey, readAppToken } from '@/shared/auth/app-token-storage'
import {
  axiosThinkzap,
  type ThinkzapHttpClient,
} from '@/infra/client/axios-thinkzap'

export const THINKZAP_SESSION_EXPIRED_MESSAGE =
  'Sessão expirada. Entre novamente.' as const

export type { ThinkzapHttpClient }

export type ResolvedThinkzapClient =
  | { ok: true; client: ThinkzapHttpClient }
  | { ok: false; message: string }

/**
 * Resolve a chave de storage do ThinkZap e instancia `axiosThinkzap`
 * (token em sessionStorage). Para uso em Client Components / handlers.
 */
export function resolveThinkzapClient(): ResolvedThinkzapClient {
  if (typeof window === 'undefined') {
    return { ok: false, message: THINKZAP_SESSION_EXPIRED_MESSAGE }
  }

  if (!readAppToken(APP_CODES.thinkzap)) {
    return { ok: false, message: THINKZAP_SESSION_EXPIRED_MESSAGE }
  }
  try {
    const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
    return { ok: true, client }
  } catch {
    return { ok: false, message: THINKZAP_SESSION_EXPIRED_MESSAGE }
  }
}

/** Extrai `result.error` da resposta da API ou usa o fallback. */
export function thinkzapApiErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 413) {
      return 'Arquivo muito grande (max. 30 MB por arquivo).'
    }

    if (e.response?.data?.result?.error) {
      return String(
        (e.response.data as { result?: { error?: string } }).result?.error,
      )
    }
  }
  return fallback
}
