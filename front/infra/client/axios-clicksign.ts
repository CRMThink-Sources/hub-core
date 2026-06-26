import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'

export const AUTH_TOKEN_KEY = 'hubthink_auth_token'

export const axiosClicksign = (authTokenKey = AUTH_TOKEN_KEY) => {
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
    error => {
      const serverError = error?.response?.data?.result?.error
      const description =
        typeof serverError === 'string'
          ? serverError
          : (serverError?.error_description ?? serverError?.message)
      if (description) return Promise.reject(new Error(description))
      return Promise.reject(
        error instanceof Error ? error : new Error('Request failed'),
      )
    },
  )
  return axiosInstance
}
