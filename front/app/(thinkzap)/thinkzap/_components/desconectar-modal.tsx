'use client'

import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface DesconectarModalProps {
  isOpen: boolean
  connector: {
    id: string
    instance: {
      name: string
    }
  } | null
  onClose: () => void
  onSuccess?: () => void
}

export function DesconectarModal({
  isOpen,
  connector,
  onClose,
  onSuccess,
}: DesconectarModalProps) {
  const { t } = useTranslation('thinkzap/modals/desconectar')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDesconectar = async () => {
    if (!connector) return

    const authTokenKey = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    if (!authTokenKey) return

    const client = axiosThinkzap(authTokenKey)

    setLoading(true)
    setError(null)

    try {
      await client.post('/thinkzap/connector/disconnect', {
        connectorId: connector.id,
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('Erro ao desconectar:', err.response?.data || err.message)
      setError(err.response?.data?.message || t('erroDesconectar'))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-black">{t('titulo')}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('descricao')} <strong>{connector?.instance.name}</strong>
            {t('descricaoComplemento')}
          </p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('acoes.cancelar')}
          </button>
          <button
            onClick={() => void handleDesconectar()}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? t('acoes.desconectando') : t('acoes.desconectar')}
          </button>
        </div>
      </div>
    </div>
  )
}
