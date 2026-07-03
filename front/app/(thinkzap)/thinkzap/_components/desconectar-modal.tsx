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
            {t('descricao')} <strong>{connector?.instance.name}</strong>
            {t('descricaoComplemento')}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('acoes.cancelar')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDesconectar()}
            disabled={loading}
          >
            {loading ? t('acoes.desconectando') : t('acoes.desconectar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
