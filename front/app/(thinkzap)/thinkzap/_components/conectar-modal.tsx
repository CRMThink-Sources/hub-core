import { useState, useEffect } from 'react'
import { useInstanceSocket } from '@/app/hooks/use-instance-socket'
import { useTranslation } from 'react-i18next'
import { AlertTriangleIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface IConectarProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (id: string) => void
  qrCode: string | null
  instanceId: string | null
  loading?: boolean
  onRefetch?: () => void
}

export function ConectarModal({
  isOpen,
  onClose,
  onSave,
  qrCode,
  instanceId,
  loading = false,
  onRefetch,
}: IConectarProps) {
  const { t } = useTranslation('thinkzap/modals/conectar')
  const [timeLeft, setTimeLeft] = useState(20)
  const [expired, setExpired] = useState(false)

  useInstanceSocket({
    instanceId,
    enabled: isOpen,
    onConnected: onClose,
  })

  useEffect(() => {
    if (!isOpen || !qrCode) return

    setTimeLeft(20)
    setExpired(false)

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, qrCode])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2Icon className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('gerandoQr')}</p>
        </div>
      )
    }

    if (qrCode && !expired) {
      return (
        <div className="flex flex-col items-center gap-3 py-4">
          <img src={qrCode} alt="QR Code" className="w-48 h-48" />
          <p className="text-sm text-muted-foreground">{t('escanearQr')}</p>
          <p className="text-sm text-destructive">
            {t('expiraEm', { segundos: timeLeft })}
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangleIcon className="size-7 text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {t('qrExpirado')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t('gerarNovo')}</p>
        </div>
        {onRefetch && (
          <Button onClick={onRefetch}>
            <RefreshCwIcon />
            {t('gerarNovoQr')}
          </Button>
        )}
      </div>
    )
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
        </DialogHeader>
        <DialogBody>{renderContent()}</DialogBody>
      </DialogContent>
    </Dialog>
  )
}
