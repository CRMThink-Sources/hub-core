'use client'

import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { envConfig } from '@/shared/infra/env-config'
import { useEffect, useState } from 'react'
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

interface Channel {
  id: string
  name: string
  active: boolean
}

interface VincularCanalModalProps {
  isOpen: boolean
  connector: { id: string; instance: { name: string } } | null
  onClose: () => void
  onSuccess?: () => Promise<void>
}

export function VincularCanalModal({
  isOpen,
  connector,
  onClose,
  onSuccess,
}: VincularCanalModalProps) {
  const { t } = useTranslation('thinkzap/modals/vincular-canal')
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
        setError(t('erroCarregar'))
      } finally {
        setLoading(false)
      }
    }

    void fetchChannels()
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
        await onSuccess()
      }

      onClose()
    } catch (err: any) {
      console.error(
        'Erro detalhado no vínculo:',
        err.response?.data || err.message,
      )
      setError(err.response?.data?.message || t('erroVincular'))
    } finally {
      setSaving(false) // Corrigido de setLoading para setSaving
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('titulo')}</DialogTitle>
          <DialogDescription>
            {t('descricao')} <strong>{connector?.instance.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          {loading && (
            <p className="text-sm text-muted-foreground">
              {t('carregandoCanais')}
            </p>
          )}

          {!loading && channels.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">{t('nenhumCanal')}</p>
          )}

          {!loading && channels.length > 0 && (
            <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {channels.map(channel => (
                <li key={channel.id}>
                  <button
                    onClick={() => setSelectedId(channel.id)}
                    className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                      selectedId === channel.id
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <span>{channel.name}</span>
                    {!channel.active && (
                      <span className="text-xs text-muted-foreground">
                        {t('inativo')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('acoes.cancelar')}
          </Button>
          <Button
            onClick={() => void handleVincular()}
            disabled={!selectedId || saving}
          >
            {saving ? t('acoes.vinculando') : t('acoes.vincular')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
