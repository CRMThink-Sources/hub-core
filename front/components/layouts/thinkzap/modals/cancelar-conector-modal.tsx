'use client'

import { useEffect, useState } from 'react'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'

type Props = {
  isOpen: boolean
  connector: {
    id: string
    nome: string
  } | null
  quantityAposCancelamento: number
  onClose: () => void
  onSuccess?: () => void
}

export function CancelarConectorModal({
  isOpen,
  connector,
  quantityAposCancelamento,
  onClose,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [estimativaLoading, setEstimativaLoading] = useState(false)
  const [estimativaNovoValor, setEstimativaNovoValor] = useState<number | null>(
    null,
  )
  const [erro, setErro] = useState<string | null>(null)

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  useEffect(() => {
    if (!isOpen || !connector) return

    const authTokenKey = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey
    if (!authTokenKey) {
      setErro('Sessão inválida para consultar estimativa.')
      return
    }

    let cancelado = false
    setEstimativaLoading(true)
    setErro(null)
    setEstimativaNovoValor(null)

    void (async () => {
      try {
        const client = axiosThinkzap(authTokenKey)
        const pricingData: any = await client.get('/thinkzap/pricing', {
          params: { quantity: quantityAposCancelamento },
        })
        if (cancelado) return
        setEstimativaNovoValor(pricingData?.estimate?.totalAmount ?? null)
      } catch (error) {
        if (cancelado) return
        console.error('Erro ao carregar estimativa:', error)
        setErro('Não foi possível carregar o novo valor estimado.')
      } finally {
        if (!cancelado) setEstimativaLoading(false)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [connector, isOpen, quantityAposCancelamento])

  const handleConfirmar = async () => {
    if (!connector) return

    try {
      setLoading(true)
      const authTokenKey = getAppRedirectUrl(
        envConfig.appCodes.thinkzap,
      )?.storageAuthTokenKey
      if (!authTokenKey) return

      const client = axiosThinkzap(authTokenKey)
      await client.post('/thinkzap/connector/cancel', {
        connectorId: connector.id,
      })
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Erro ao cancelar conector:', error)
      setErro('Não foi possível cancelar o conector.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !connector) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Cancelar conector
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          Você está cancelando o conector{' '}
          <span className="font-semibold text-gray-800">{connector.nome}</span>.
          Isso reduz 1 linha da assinatura.
        </p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
            Novo valor mensal
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {estimativaLoading ? (
              'Carregando estimativa...'
            ) : estimativaNovoValor != null ? (
              <>
                Com {quantityAposCancelamento} linha
                {quantityAposCancelamento !== 1 ? 's' : ''}: R${' '}
                {formatCurrency(estimativaNovoValor)}
              </>
            ) : (
              'Estimativa indisponível no momento.'
            )}
          </p>
        </div>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={loading}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmar()}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
