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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AGENT_TYPES,
  COMMUNICATION_TYPES,
  apiErrorMessage,
  createAgent,
  type Agent,
  type AgentType,
  type CommunicationType,
} from '../_lib/gptmaker-client'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (agent: Agent) => void
}

const TOTAL_STEPS = 2

/**
 * Todos os campos são obrigatórios porque o GPT Maker os exige na criação: sem
 * `type` ou `jobDescription` ele responde `400 {"error":"<campo> is required"}`.
 * Barrar aqui troca esse erro de integração por uma mensagem nossa, antes de
 * gastar uma ida ao vendor.
 */
export function CreateAgentModal({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation('gptmaker/agentes')

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [type, setType] = useState<AgentType>('SUPPORT')
  const [communicationType, setCommunicationType] =
    useState<CommunicationType>('NORMAL')
  const [jobName, setJobName] = useState('')
  const [jobSite, setJobSite] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [behavior, setBehavior] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setStep(1)
    setName('')
    setType('SUPPORT')
    setCommunicationType('NORMAL')
    setJobName('')
    setJobSite('')
    setJobDescription('')
    setBehavior('')
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  function handleNext() {
    if (!name.trim()) {
      toast.error(t('criar.nomeObrigatorio'))
      return
    }

    setStep(2)
  }

  async function handleSubmit() {
    const trabalho = [jobName, jobSite, jobDescription, behavior]
    if (trabalho.some(field => !field.trim())) {
      toast.error(t('criar.camposObrigatorios'))
      return
    }

    setSaving(true)
    try {
      const agent = await createAgent({
        name: name.trim(),
        type,
        communicationType,
        jobName: jobName.trim(),
        jobSite: jobSite.trim(),
        jobDescription: jobDescription.trim(),
        behavior: behavior.trim(),
      })

      toast.success(t('criar.sucesso'))
      onCreated(agent)
      close()
    } catch (e) {
      toast.error(apiErrorMessage(e, t('criar.erro')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={aberto => (aberto ? null : close())}>
      <DialogContent className="max-w-lg p-4">
        <DialogHeader>
          <DialogTitle>{t('criar.titulo')}</DialogTitle>
          <DialogDescription>
            {step === 1 ? t('criar.passo1Titulo') : t('criar.passo2Titulo')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 my-4">
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <span
                key={index}
                className={`h-1 flex-1 rounded-full ${
                  index < step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {t('criar.passo', { atual: step, total: TOTAL_STEPS })}
          </span>
        </div>

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-name">{t('campos.nome')} *</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('campos.nomePlaceholder')}
                autoFocus
              />
              {/* O nome vai ao GPT Maker exatamente como digitado: é com ele que
                  o agente se apresenta ao cliente final. */}
              <p className="text-xs text-muted-foreground">
                {t('campos.nomeAjuda')}
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label>{t('campos.tipo')} *</Label>
                <Select
                  value={type}
                  onValueChange={value => setType(value as AgentType)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string) => t(`campos.tipoOpcoes.${value}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map(option => (
                      <SelectItem key={option} value={option}>
                        {t(`campos.tipoOpcoes.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label>{t('campos.comunicacao')} *</Label>
                <Select
                  value={communicationType}
                  onValueChange={value =>
                    setCommunicationType(value as CommunicationType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string) =>
                        t(`campos.comunicacaoOpcoes.${value}`)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNICATION_TYPES.map(option => (
                      <SelectItem key={option} value={option}>
                        {t(`campos.comunicacaoOpcoes.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('criar.tipoAjuda')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor="agent-job-name">{t('campos.cargo')} *</Label>
                <Input
                  id="agent-job-name"
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor="agent-job-site">{t('campos.site')} *</Label>
                <Input
                  id="agent-job-site"
                  value={jobSite}
                  onChange={e => setJobSite(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-job-description">
                {t('campos.descricao')} *
              </Label>
              <textarea
                id="agent-job-description"
                className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-behavior">
                {t('campos.comportamento')} *
              </Label>
              <textarea
                id="agent-behavior"
                className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={behavior}
                onChange={e => setBehavior(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('campos.comportamentoAjuda')}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={close} disabled={saving}>
                {t('acoes.cancelar')}
              </Button>
              <Button onClick={handleNext}>{t('acoes.avancar')}</Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={saving}
              >
                {t('acoes.voltar')}
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={saving}>
                {saving ? t('acoes.criando') : t('acoes.criar')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
