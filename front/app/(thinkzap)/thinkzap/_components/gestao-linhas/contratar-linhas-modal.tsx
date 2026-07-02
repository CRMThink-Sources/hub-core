'use client'

import { useEffect, useState } from 'react'
import { resolveThinkzapClient } from '../../_lib/thinkzap-client'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  const { t } = useTranslation('thinkzap/gestao-linhas/contratar-modal')
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
          if (!cancelado) setPreviewErro(t('erroSessao'))
          return
        }

        const data = await resolved.client.get<PreviewData>(
          '/thinkzap/subscription/add-quantity-preview',
          { params: { additionalQuantity: quantidade } },
        )

        if (!cancelado) setPreview(data)
      } catch {
        if (!cancelado) setPreviewErro(t('erroEstimativa'))
      } finally {
        if (!cancelado) setPreviewLoading(false)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [isOpen, quantidade])

  const novasLinhas = quantidade
  const totalLinhas = linhasNaAssinatura + quantidade

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('titulo')}</DialogTitle>
          <DialogDescription>{t('subtitulo')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {/* Resumo */}
          <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('linhasAtuais')}</span>
              <span className="font-medium text-foreground">
                {t('linha', { count: linhasNaAssinatura })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('adicionando')}</span>
              <span className="font-medium text-primary">
                + {t('linha', { count: novasLinhas })}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span className="text-foreground">
                {t('totalAposConfirmacao')}
              </span>
              <span className="text-foreground">
                {t('linha', { count: totalLinhas })}
              </span>
            </div>
          </div>

          {/* Estimativa de valor */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
              {t('valorMensalEstimado')}
            </p>

            {previewLoading && (
              <p className="mt-2 text-sm text-blue-800">
                {t('carregandoEstimativa')}
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
                    <p className="text-lg font-bold text-primary">
                      R${' '}
                      {formatCurrency(
                        preview.discount.estimatedAmountWithDiscount ?? 0,
                      )}
                    </p>
                    <p className="text-xs text-blue-700">
                      {t('cupomAplicado')}{' '}
                      <span className="font-semibold">
                        {preview.discount.name ?? t('descontoAtivo')}
                      </span>{' '}
                      {preview.discount.percentOff != null
                        ? t('percentDesconto', {
                            percent: preview.discount.percentOff,
                          })
                        : preview.discount.amountOff != null
                          ? t('valorDesconto', {
                              valor: formatCurrency(preview.discount.amountOff),
                            })
                          : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold text-foreground">
                    {preview.estimatedMonthlyAmount != null
                      ? `R$ ${formatCurrency(preview.estimatedMonthlyAmount)}`
                      : '—'}
                  </p>
                )}
                <p className="text-xs text-blue-600">{t('proRata')}</p>
              </div>
            )}

            {!previewLoading && !preview && !previewErro && (
              <p className="mt-2 text-sm text-blue-800">—</p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('acoes.cancelar')}
          </Button>
          <Button onClick={onConfirm} disabled={submitting || previewLoading}>
            {submitting
              ? t('acoes.confirmando')
              : t('acoes.confirmar', { count: novasLinhas })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
