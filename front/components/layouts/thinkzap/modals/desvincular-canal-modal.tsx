'use client'

import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import { useState } from 'react'

interface DesvincularCanalModalProps {
  isOpen: boolean
  connector: {
    id: string
    instance: {
      name: string
      vinculatedChannel?: string
      vinculatedChannelName?: string
    }
  } | null
  onClose: () => void
  onSuccess?: () => void
}

export function DesvincularCanalModal({
  isOpen,
  connector,
  onClose,
  onSuccess,
}: DesvincularCanalModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDesvincular = async () => {
    if (!connector?.instance.vinculatedChannel) return

    const authTokenKey = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    if (!authTokenKey) return

    const client = axiosThinkzap(authTokenKey)

    setLoading(true)
    setError(null)

    try {
      await client.post('/thinkzap/connector/disconnect-channel', {
        connectorId: connector.id,
        lineId: Number(connector.instance.vinculatedChannel),
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error(
        'Erro ao desvincular canal:',
        err.response?.data || err.message,
      )
      setError(err.response?.data?.message || 'Erro ao desvincular canal.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-black">
            Desvincular canal
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tem certeza que deseja desvincular o canal{' '}
            <strong>
              {connector?.instance.vinculatedChannelName || 'selecionado'}
            </strong>{' '}
            da instância <strong>{connector?.instance.name}</strong>?
          </p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleDesvincular()}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Desvinculando...' : 'Desvincular'}
          </button>
        </div>
      </div>
    </div>
  )
}
