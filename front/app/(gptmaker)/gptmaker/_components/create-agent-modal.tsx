'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  apiErrorMessage,
  createAgent,
  type Agent,
} from '../_lib/gptmaker-client'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (agent: Agent) => void
}

export function CreateAgentModal({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation('gptmaker/agentes')

  const [name, setName] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobSite, setJobSite] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [behavior, setBehavior] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setName('')
    setJobName('')
    setJobSite('')
    setJobDescription('')
    setBehavior('')
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error(t('criar.nomeObrigatorio'))
      return
    }

    setSaving(true)
    try {
      const agent = await createAgent({
        name: name.trim(),
        jobName: jobName.trim() || undefined,
        jobSite: jobSite.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        behavior: behavior.trim() || undefined,
      })

      toast.success(t('criar.sucesso'))
      reset()
      onCreated(agent)
      onOpenChange(false)
    } catch (e) {
      toast.error(apiErrorMessage(e, t('criar.erro')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('criar.titulo')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-name">{t('campos.nome')}</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('campos.nomePlaceholder')}
            />
            {/* O nome vai ao GPT Maker exatamente como digitado: é com ele que
                o agente se apresenta ao cliente final. */}
            <p className="text-xs text-muted-foreground">
              {t('campos.nomeAjuda')}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-job-name">{t('campos.cargo')}</Label>
            <Input
              id="agent-job-name"
              value={jobName}
              onChange={e => setJobName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-job-site">{t('campos.site')}</Label>
            <Input
              id="agent-job-site"
              value={jobSite}
              onChange={e => setJobSite(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-job-description">
              {t('campos.descricao')}
            </Label>
            <textarea
              id="agent-job-description"
              className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-behavior">{t('campos.comportamento')}</Label>
            <textarea
              id="agent-behavior"
              className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={behavior}
              onChange={e => setBehavior(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
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
