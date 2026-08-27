'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
  updateAgentProfile,
  type Agent,
  type AgentType,
  type CommunicationType,
} from '../_lib/gptmaker-client'

type Props = {
  agent: Agent
  onSaved: () => void
}

export function AgentProfileForm({ agent, onSaved }: Props) {
  const { t } = useTranslation('gptmaker/agentes')

  const vendor = agent.vendor

  const [name, setName] = useState(vendor?.name ?? agent.name ?? '')
  const [behavior, setBehavior] = useState(vendor?.behavior ?? '')
  const [jobName, setJobName] = useState(vendor?.jobName ?? '')
  const [jobSite, setJobSite] = useState(vendor?.jobSite ?? '')
  const [jobDescription, setJobDescription] = useState(
    vendor?.jobDescription ?? '',
  )
  const [communicationType, setCommunicationType] = useState<CommunicationType>(
    vendor?.communicationType ?? 'NORMAL',
  )
  const [type, setType] = useState<AgentType>(vendor?.type ?? 'SUPPORT')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      toast.error(t('criar.nomeObrigatorio'))
      return
    }

    setSaving(true)
    try {
      await updateAgentProfile(agent.gptMakerAgentId, {
        name: name.trim(),
        behavior,
        jobName,
        jobSite,
        jobDescription,
        communicationType,
        type,
      })
      toast.success(t('perfil.sucesso'))
      onSaved()
    } catch (e) {
      toast.error(apiErrorMessage(e, t('perfil.erro')))
    } finally {
      setSaving(false)
    }
  }

  // Sem o perfil do vendor não há o que editar: salvar aqui sobrescreveria os
  // campos que não vieram com string vazia.
  if (!vendor) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        {t('perfil.indisponivel')}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-medium">{t('perfil.titulo')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('perfil.subtitulo')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name">{t('campos.nome')}</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t('campos.nomeAjuda')}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-52 flex-1 flex-col gap-1.5">
          <Label>{t('campos.comunicacao')}</Label>
          <Select
            value={communicationType}
            onValueChange={value =>
              setCommunicationType(value as CommunicationType)
            }
          >
            <SelectTrigger>
              <SelectValue>
                {(value: string) => t(`campos.comunicacaoOpcoes.${value}`)}
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

        <div className="flex min-w-52 flex-1 flex-col gap-1.5">
          <Label>{t('campos.tipo')}</Label>
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-job-name">{t('campos.cargo')}</Label>
        <Input
          id="profile-job-name"
          value={jobName}
          onChange={e => setJobName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-job-site">{t('campos.site')}</Label>
        <Input
          id="profile-job-site"
          value={jobSite}
          onChange={e => setJobSite(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-job-description">{t('campos.descricao')}</Label>
        <textarea
          id="profile-job-description"
          className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-behavior">{t('campos.comportamento')}</Label>
        <textarea
          id="profile-behavior"
          className="min-h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={behavior}
          onChange={e => setBehavior(e.target.value)}
        />
      </div>

      <div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? t('acoes.salvando') : t('acoes.salvar')}
        </Button>
      </div>
    </section>
  )
}
