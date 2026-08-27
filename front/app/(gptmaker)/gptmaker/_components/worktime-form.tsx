'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  apiErrorMessage,
  updateAgentSettings,
  type Agent,
  type Worktime,
} from '../_lib/gptmaker-client'

const WEEKDAY_KEYS = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
] as const

type Props = {
  agent: Agent
  onSaved: (agent: Agent) => void
}

export function WorktimeForm({ agent, onSaved }: Props) {
  const { t } = useTranslation('gptmaker/agentes')

  const [worktime, setWorktime] = useState<Worktime>(agent.worktime)
  const [exitOnCollaboratorJoin, setExitOnCollaboratorJoin] = useState(
    agent.exitOnCollaboratorJoin,
  )
  const [saving, setSaving] = useState(false)

  function patch(changes: Partial<Worktime>) {
    setWorktime(current => ({ ...current, ...changes }))
  }

  function toggleDay(day: number) {
    patch({
      activeDays: worktime.activeDays.includes(day)
        ? worktime.activeDays.filter(d => d !== day)
        : [...worktime.activeDays, day].sort(),
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateAgentSettings(agent.gptMakerAgentId, {
        worktime,
        exitOnCollaboratorJoin,
      })
      toast.success(t('horario.sucesso'))
      onSaved(updated)
    } catch (e) {
      toast.error(apiErrorMessage(e, t('horario.erro')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-medium">{t('horario.titulo')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('horario.subtitulo')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="worktime-enabled"
          checked={worktime.enabled}
          onCheckedChange={checked => patch({ enabled: checked })}
        />
        <Label htmlFor="worktime-enabled">{t('horario.ativar')}</Label>
      </div>

      {worktime.enabled && (
        <>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="init-hour">{t('horario.inicio')}</Label>
              <Input
                id="init-hour"
                type="time"
                value={worktime.initHour ?? ''}
                onChange={e => patch({ initHour: e.target.value || null })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end-hour">{t('horario.fim')}</Label>
              <Input
                id="end-hour"
                type="time"
                value={worktime.endHour ?? ''}
                onChange={e => patch({ endHour: e.target.value || null })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timezone">{t('horario.fuso')}</Label>
              <Input
                id="timezone"
                value={worktime.timezone ?? ''}
                placeholder="America/Sao_Paulo"
                onChange={e => patch({ timezone: e.target.value || null })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('horario.diasAtivos')}</Label>
            <div className="flex flex-wrap gap-3">
              {WEEKDAY_KEYS.map((key, day) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={worktime.activeDays.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                  />
                  {t(`horario.dias.${key}`)}
                </label>
              ))}
            </div>
          </div>

          {/* O nome antigo (`activeOfHours`) dizia o oposto do que o código
              fazia. A tela agora explica a inversão em vez de só rotular. */}
          <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <Switch
                id="responds-only-off-hours"
                checked={worktime.respondsOnlyOffHours}
                onCheckedChange={checked =>
                  patch({ respondsOnlyOffHours: checked })
                }
              />
              <Label htmlFor="responds-only-off-hours">
                {t('horario.inverter')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {worktime.respondsOnlyOffHours
                ? t('horario.inverterLigado')
                : t('horario.inverterDesligado')}
            </p>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 border-t pt-4">
        <Switch
          id="exit-on-collaborator"
          checked={exitOnCollaboratorJoin}
          onCheckedChange={setExitOnCollaboratorJoin}
        />
        <Label htmlFor="exit-on-collaborator">
          {t('horario.sairComColaborador')}
        </Label>
      </div>

      <div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? t('acoes.salvando') : t('acoes.salvar')}
        </Button>
      </div>
    </section>
  )
}
