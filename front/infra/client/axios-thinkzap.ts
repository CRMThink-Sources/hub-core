/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */

import { envConfig } from '@/shared/infra/env-config'
import axios, { type AxiosInstance } from 'axios'

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
  put<T>(
    url: string,
    data?: unknown,
    config?: Parameters<AxiosInstance['put']>[2],
  ): Promise<T>
  patch<T>(
    url: string,
    data?: unknown,
    config?: Parameters<AxiosInstance['patch']>[2],
  ): Promise<T>
  delete<T>(
    url: string,
    config?: Parameters<AxiosInstance['delete']>[1],
  ): Promise<T>
}

export const axiosThinkzap = (authTokenKey: string): ThinkzapHttpClient => {
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
  axiosInstance.interceptors.request.use(config => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      config.headers.set('Content-Type', false)
    }
    return config
  })
  axiosInstance.interceptors.response.use(
    response => {
      return response.data.result
    },
    error => {
      return Promise.reject(error)
    },
  )
  return axiosInstance
}
