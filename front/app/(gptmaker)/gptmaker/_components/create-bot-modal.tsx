'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  apiErrorMessage,
  createBot,
  type PortalBot,
} from '../_lib/gptmaker-client'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (bot: PortalBot) => void
}

export function CreateBotModal({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation('gptmaker/bots')

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  function close() {
    setName('')
    onOpenChange(false)
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error(t('criar.nomeObrigatorio'))
      return
    }

    setSaving(true)
    try {
      const bot = await createBot(name.trim())
      toast.success(t('criar.sucesso'))
      onCreated(bot)
      close()
    } catch (e) {
      toast.error(apiErrorMessage(e, t('criar.erro')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={aberto => (aberto ? null : close())}>
      <DialogContent className="max-w-md p-4">
        <DialogHeader>
          <DialogTitle>{t('criar.titulo')}</DialogTitle>
          <DialogDescription>{t('criar.subtitulo')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bot-name">{t('campos.nome')} *</Label>
          <Input
            id="bot-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('campos.nomePlaceholder')}
            autoFocus
          />
          {/* É este nome que aparece para o cliente final no canal aberto. */}
          <p className="text-xs text-muted-foreground">
            {t('campos.nomeAjuda')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            {t('acoes.cancelar')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? t('acoes.criando') : t('acoes.criar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
