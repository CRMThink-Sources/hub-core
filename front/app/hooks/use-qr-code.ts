import { useState } from 'react'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'

export const useQrCode = () => {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchQrCode = async (connectorId: string) => {
    const authTokenKey = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    if (!authTokenKey) return

    const client = axiosThinkzap(authTokenKey)
    setLoading(true)
    try {
      const data = await client.get(
        `/thinkzap/connector/${connectorId}/qr-code`,
      )
      console.log('retorno:', data)
      setQrCode((data as any).value)
    } catch (err) {
      console.error('Erro ao buscar QR code:', err)
    } finally {
      setLoading(false)
    }
  }

  return { qrCode, loading, fetchQrCode }
}
