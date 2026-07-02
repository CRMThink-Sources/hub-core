'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
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
  const { t } = useTranslation('thinkzap/modals/cancelar-conector')
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
      setErro(t('erroSessao'))
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
        setErro(t('erroEstimativa'))
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
      setErro(t('erroCancelar'))
    } finally {
      setLoading(false)
    }
  }

  if (!connector) return null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('titulo')}</DialogTitle>
          <DialogDescription>
            {t('descricao')}{' '}
            <span className="font-semibold text-foreground">
              {connector.nome}
            </span>
            {t('descricaoComplemento')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
              {t('novoValorMensal')}
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {estimativaLoading
                ? t('carregandoEstimativa')
                : estimativaNovoValor != null
                  ? t(
                      quantityAposCancelamento === 1
                        ? 'comLinhas_one'
                        : 'comLinhas_other',
                      {
                        count: quantityAposCancelamento,
                        valor: formatCurrency(estimativaNovoValor),
                      },
                    )
                  : t('estimativaIndisponivel')}
            </p>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('acoes.voltar')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirmar()}
            disabled={loading}
          >
            {loading ? t('acoes.cancelando') : t('acoes.confirmar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
