import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'

export const axiosThinkzap = (authTokenKey: string) => {
  const token = sessionStorage.getItem(authTokenKey)
  if (!token) {
    throw new Error('Token not found')
  }
  return axios.create({
    baseURL: envConfig.apiUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}
