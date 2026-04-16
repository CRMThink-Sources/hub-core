import axios, { type AxiosInstance } from 'axios'

import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'

export const THINKZAP_SESSION_EXPIRED_MESSAGE =
  'Sessão expirada. Entre novamente.' as const

/**
 * Contrato do axiosThinkzap após o interceptor (corpo já é `response.data.result`).
 */
export type ThinkzapHttpClient = {
  get<T>(url: string, config?: Parameters<AxiosInstance['get']>[1]): Promise<T>
  post<T>(
    url: string,
    data?: unknown,
    config?: Parameters<AxiosInstance['post']>[2],
  ): Promise<T>
}

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

  const authStorageKey =
    getAppRedirectUrl(envConfig.appCodes.thinkzap)?.storageAuthTokenKey ?? null
  if (!authStorageKey) {
    return { ok: false, message: THINKZAP_SESSION_EXPIRED_MESSAGE }
  }
  if (!sessionStorage.getItem(authStorageKey)) {
    return { ok: false, message: THINKZAP_SESSION_EXPIRED_MESSAGE }
  }
  try {
    const client = axiosThinkzap(
      authStorageKey,
    ) as unknown as ThinkzapHttpClient
    return { ok: true, client }
  } catch {
    return { ok: false, message: THINKZAP_SESSION_EXPIRED_MESSAGE }
  }
}

/** Extrai `result.error` da resposta da API ou usa o fallback. */
export function thinkzapApiErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.result?.error) {
    return String(
      (e.response.data as { result?: { error?: string } }).result?.error,
    )
  }
  return fallback
}
