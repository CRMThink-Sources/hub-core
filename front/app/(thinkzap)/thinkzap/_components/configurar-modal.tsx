import { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Connector {
  id: string
  instance: {
    name: string
    phoneNumber: string
    vinculatedChannel: string | null
  }
}

interface IConfigurarProps {
  isOpen: boolean
  connector: Connector | null
  onClose: () => void
  onSave: (id: string, name: string) => void
}

export function ConfigurarModal({
  isOpen,
  connector,
  onClose,
  onSave,
}: IConfigurarProps) {
  const { t } = useTranslation('thinkzap/modals/configurar')
  const [channel, setChannel] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (connector) {
      setName(connector.instance.name)
    }
  }, [connector])

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('titulo')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('campos.nomeCanal')}</Label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {connector.instance.phoneNumber && (
            <div className="flex flex-col gap-2">
              <Label>{t('campos.telefone')}</Label>
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {connector.instance.phoneNumber}
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('acoes.cancelar')}
          </Button>
          <Button onClick={() => onSave(connector.id, name)}>
            {t('acoes.salvar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
