import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'

/**
 * Client HTTP do ThinkAnalise. Co-localizado no app (mesmo padrão do
 * ThinkZap em `_lib/thinkzap-client.ts`): instancia `axios` com o token de
 * sessão e desembrulha `result`/`result.error` da resposta da API.
 */
export const AUTH_TOKEN_KEY = 'hubthink_auth_token'

export const axiosThinkanalise = (authTokenKey = AUTH_TOKEN_KEY) => {
  const token = sessionStorage.getItem(authTokenKey)
  if (!token) {
    throw new Error('Token not found')
  }
  const axiosInstance = axios.create({
    baseURL: envConfig.apiUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  axiosInstance.interceptors.response.use(
    response => {
      const result = response.data?.result ?? response.data
      if (result?.error) {
        const description =
          result.error.error_description ?? 'Erro desconhecido.'
        return Promise.reject(new Error(description))
      }
      return result
    },
    error =>
      Promise.reject(
        error instanceof Error ? error : new Error('Request failed'),
      ),
  )
  return axiosInstance
}
