'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NovoFluxoDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<void>
}) {
  const { t } = useTranslation('thinkzap/bots/lista')
  const [name, setName] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Reabrir com texto anterior sugeriria fluxo meio criado
  useEffect(() => {
    if (!open) {
      setName('')
      setSalvando(false)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) return

    setSalvando(true)
    await onSubmit(name.trim())
    setSalvando(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && salvando) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={event => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{t('novo.titulo')}</DialogTitle>
            <DialogDescription>{t('novo.descricao')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="novo-fluxo-nome">{t('novo.nome')}</Label>
              <Input
                id="novo-fluxo-nome"
                value={name}
                autoFocus
                maxLength={120}
                disabled={salvando}
                placeholder={t('novo.placeholder')}
                onChange={event => setName(event.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={salvando}
              onClick={() => onOpenChange(false)}
            >
              {t('novo.cancelar')}
            </Button>
            <Button
              type="submit"
              disabled={salvando || name.trim().length === 0}
            >
              {salvando ? t('novo.criando') : t('novo.criar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
