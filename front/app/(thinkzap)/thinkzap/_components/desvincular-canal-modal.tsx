'use client'

import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  const { t } = useTranslation('thinkzap/modals/desvincular-canal')
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
      setError(err.response?.data?.message || t('erroDesvincular'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('titulo')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t('descricao')}{' '}
            <strong>
              {connector?.instance.vinculatedChannelName || t('selecionado')}
            </strong>{' '}
            {t('descricaoDaInstancia')}{' '}
            <strong>{connector?.instance.name}</strong>?
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('acoes.cancelar')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDesvincular()}
            disabled={loading}
          >
            {loading ? t('acoes.desvinculando') : t('acoes.desvincular')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
