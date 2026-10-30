import { envConfig } from '@/shared/infra/env-config'
import axios, { type AxiosInstance } from 'axios'
import { getPortalToken } from '@/lib/portal-auth'

export type PortalHttpClient = {
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

export const axiosPortal = (): PortalHttpClient => {
  const token = getPortalToken()
  if (!token) {
    throw new Error('Token not found')
  }

  const axiosInstance = axios.create({
    baseURL: envConfig.apiUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  })

  axiosInstance.interceptors.response.use(
    response => response.data.result,
    error =>
      Promise.reject(
        error instanceof Error ? error : new Error('Request failed'),
      ),
  )

  return axiosInstance
}

export async function portalLogin(
  email: string,
  password: string,
): Promise<{ token: string }> {
  const response = await axios.post(
    `${envConfig.apiUrl}/portal/auth/login`,
    { email, password },
    { headers: { 'ngrok-skip-browser-warning': 'true' } },
  )

  return response.data.result as { token: string }
}
