'use client'

import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import { useEffect, useState } from 'react'

interface Channel {
  id: string
  name: string
  active: boolean
}

interface VincularCanalModalProps {
  isOpen: boolean
  connector: { id: string; instance: { name: string } } | null
  onClose: () => void
  onSuccess?: () => void
}

export function VincularCanalModal({
  isOpen,
  connector,
  onClose,
  onSuccess,
}: VincularCanalModalProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchChannels = async () => {
      const authTokenKey = getAppRedirectUrl(
        envConfig.appCodes.thinkzap,
      )?.storageAuthTokenKey

      if (!authTokenKey) return

      const client = axiosThinkzap(authTokenKey)

      setSelectedId(null)
      setError(null)
      setLoading(true)

      try {
        const res = await client.get('/thinkzap/openchannels')

        const responseData = res as any
        const canais =
          responseData?.channels || responseData?.data?.channels || []

        setChannels(canais)
      } catch (err: any) {
        if (err.response) {
          console.error(
            '[ERRO API] Status:',
            err.response.status,
            'Dados:',
            err.response.data,
          )
        } else if (err.request) {
          console.error(
            '[ERRO REDE/CORS] Sem resposta do servidor. Verifique CORS ou a URL.',
          )
        } else {
          console.error('[ERRO GERAL]', err.message)
        }
        setError('Erro ao carregar canais.')
      } finally {
        setLoading(false)
      }
    }

    fetchChannels()
  }, [isOpen])

  const handleVincular = async () => {
    if (!selectedId || !connector) {
      console.warn('Faltando selectedId ou connector')
      return
    }

    const authTokenKey = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    if (!authTokenKey) {
      console.error('Token de autenticação não encontrado')
      return
    }

    const client = axiosThinkzap(authTokenKey)

    setSaving(true)
    setError(null)

    try {
      const payload = {
        connectorId: connector.id,
        lineId: isNaN(Number(selectedId)) ? selectedId : Number(selectedId),
      }

      console.log('Enviando Payload:', payload)

      const res = await client.post(
        '/thinkzap/connector/vinculate-channel',
        payload,
      )

      console.log('Sucesso na API:', res)

      if (onSuccess) {
        console.log('Chamando callback onSuccess')
        onSuccess()
      }

      onClose()
    } catch (err: any) {
      console.error(
        'Erro detalhado no vínculo:',
        err.response?.data || err.message,
      )
      setError(err.response?.data?.message || 'Erro ao vincular canal')
    } finally {
      setSaving(false) // Corrigido de setLoading para setSaving
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-black">Vincular canal</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Selecione o canal para vincular a{' '}
            <strong>{connector?.instance.name}</strong>
          </p>
        </div>

        {loading && (
          <p className="text-sm text-gray-400">Carregando canais...</p>
        )}

        {!loading && channels.length === 0 && !error && (
          <p className="text-sm text-gray-400">Nenhum canal disponível.</p>
        )}

        {!loading && channels.length > 0 && (
          <ul className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {channels.map(channel => (
              <li key={channel.id}>
                <button
                  onClick={() => setSelectedId(channel.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                    selectedId === channel.id
                      ? 'bg-[#e8fdf0] text-[#144A1B] font-medium'
                      : 'hover:bg-gray-50 text-black'
                  }`}
                >
                  <span className="cursor-pointer">{channel.name}</span>
                  {!channel.active && (
                    <span className="text-xs text-gray-400">Inativo</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleVincular}
            disabled={!selectedId || saving}
            className="px-4 py-2 text-sm rounded-md bg-[#5A997E] text-white font-medium hover:bg-[#4a8169] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? 'Vinculando...' : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  )
}
