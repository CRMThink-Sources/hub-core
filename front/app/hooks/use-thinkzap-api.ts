import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { type ThinkzapHttpClient } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'
import { useMemo } from 'react'

export function useThinkzapApi(): ThinkzapHttpClient {
  return useMemo(() => {
    const authTokenKey = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    const token =
      typeof window !== 'undefined' && authTokenKey
        ? sessionStorage.getItem(authTokenKey)
        : null

    const client = axios.create({
      baseURL: envConfig.apiUrl,
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    })

    client.interceptors.response.use(
      response => response.data?.result ?? response.data,
      error => {
        const message =
          error?.response?.data?.error?.message ??
          error?.response?.data?.error ??
          error?.message ??
          'Request failed'
        return Promise.reject(new Error(String(message)))
      },
    )

    return client
  }, [])
}
