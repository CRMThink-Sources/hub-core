/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'

export const axiosThinkzap = (authTokenKey: string) => {
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
      return response.data.result
    },
    error => {
      return Promise.reject(error)
    },
  )
  return axiosInstance
}
