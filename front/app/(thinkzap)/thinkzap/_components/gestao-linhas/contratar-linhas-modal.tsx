'use client'

import { useEffect, useState } from 'react'
import { resolveThinkzapClient } from '../../_lib/thinkzap-client'

type PreviewData = {
  currentQuantity: number
  additionalQuantity: number
  newQuantity: number
  currency: string
  estimatedMonthlyAmount: number | null
  discount: {
    name: string | null
    percentOff: number | null
    amountOff: number | null
    currency: string | null
    estimatedAmountWithDiscount: number | null
  } | null
}

type Props = {
  isOpen: boolean
  quantidade: number
  linhasNaAssinatura: number
  onClose: () => void
  onConfirm: () => void
  submitting: boolean
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ContratarLinhasModal({
  isOpen,
  quantidade,
  linhasNaAssinatura,
  onClose,
  onConfirm,
  submitting,
}: Props) {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewErro, setPreviewErro] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || quantidade < 1) return

    let cancelado = false
    setPreviewLoading(true)
    setPreviewErro(null)
    setPreview(null)

    void (async () => {
      try {
        const resolved = resolveThinkzapClient()
        if (!resolved.ok) {
          if (!cancelado) setPreviewErro('Sessão inválida.')
          return
        }

        const data = await resolved.client.get<PreviewData>(
          '/thinkzap/subscription/add-quantity-preview',
          { params: { additionalQuantity: quantidade } },
        )

        if (!cancelado) setPreview(data)
      } catch {
        if (!cancelado)
          setPreviewErro(
            'Não foi possível carregar a estimativa. Os valores exibidos são aproximados.',
          )
      } finally {
        if (!cancelado) setPreviewLoading(false)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [isOpen, quantidade])

  if (!isOpen) return null

  const novasLinhas = quantidade
  const totalLinhas = linhasNaAssinatura + quantidade

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Confirmar contratação
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Revise o resumo abaixo antes de confirmar.
        </p>

        {/* Resumo */}
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Linhas atuais</span>
            <span className="font-medium text-gray-800">
              {linhasNaAssinatura} linha{linhasNaAssinatura !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Adicionando</span>
            <span className="font-medium text-[#5A997E]">
              + {novasLinhas} linha{novasLinhas !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-semibold">
            <span className="text-gray-800">Total após confirmação</span>
            <span className="text-gray-900">
              {totalLinhas} linha{totalLinhas !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Estimativa de valor */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
            Valor mensal estimado
          </p>

          {previewLoading && (
            <p className="mt-2 text-sm text-blue-800">
              Carregando estimativa...
            </p>
          )}

          {!previewLoading && previewErro && (
            <p className="mt-2 text-sm text-amber-700">{previewErro}</p>
          )}

          {!previewLoading && preview && (
            <div className="mt-2 space-y-1">
              {preview.discount ? (
                <>
                  <p className="text-sm text-blue-900 line-through opacity-60">
                    R$ {formatCurrency(preview.estimatedMonthlyAmount ?? 0)}
                  </p>
                  <p className="text-lg font-bold text-[#5A997E]">
                    R${' '}
                    {formatCurrency(
                      preview.discount.estimatedAmountWithDiscount ?? 0,
                    )}
                  </p>
                  <p className="text-xs text-blue-700">
                    Cupom aplicado:{' '}
                    <span className="font-semibold">
                      {preview.discount.name ?? 'Desconto ativo'}
                    </span>{' '}
                    {preview.discount.percentOff != null
                      ? `(${preview.discount.percentOff}% de desconto)`
                      : preview.discount.amountOff != null
                        ? `(R$ ${formatCurrency(preview.discount.amountOff)} de desconto)`
                        : ''}
                  </p>
                </>
              ) : (
                <p className="text-lg font-bold text-gray-800">
                  {preview.estimatedMonthlyAmount != null
                    ? `R$ ${formatCurrency(preview.estimatedMonthlyAmount)}`
                    : '—'}
                </p>
              )}
              <p className="text-xs text-blue-600">
                Ajustes no ciclo atual geram cobrança proporcional (pró-rata).
              </p>
            </div>
          )}

          {!previewLoading && !preview && !previewErro && (
            <p className="mt-2 text-sm text-blue-800">—</p>
          )}
        </div>

        {/* Ações */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting || previewLoading}
            className="inline-flex items-center justify-center rounded-lg bg-[#5A997E] px-5 py-2 text-sm font-medium text-white hover:bg-[#4a8169] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? 'Confirmando...'
              : `Confirmar ${novasLinhas} linha${novasLinhas !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
