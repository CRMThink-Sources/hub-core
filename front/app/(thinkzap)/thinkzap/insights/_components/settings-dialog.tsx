'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { InsightsConfig } from '@/app/hooks/insights-types'
import { ErrorBox } from './states'

type Draft = {
  refMin: string
  bhStart: string
  bhEnd: string
  stuckDays: string
  dealWindowDays: string
  bhDays: number[]
  bizOnly: boolean
  sources: string[]
}

const toDraft = (c: InsightsConfig): Draft => ({
  refMin: String(c.refMin),
  bhStart: String(c.bhStart),
  bhEnd: String(c.bhEnd),
  stuckDays: String(c.stuckDays),
  dealWindowDays: String(c.dealWindowDays),
  bhDays: [...c.bhDays],
  bizOnly: c.bizOnly,
  sources: [...c.sources],
})

const toggle = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter(x => x !== item) : [...list, item]

const numberField = 'h-8 w-20'

/**
 * Configurações do painel (só admin). Os limites (refMin mínimo 1, horário
 * 0–24, etc.) são normalizados pela API, que devolve o que gravou: a tela não
 * repete as regras para não divergir delas.
 *
 * Quem usa monta o diálogo só enquanto está aberto: o rascunho nasce da
 * configuração salva a cada abertura, e um rascunho abandonado não volta.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  config,
  sourcesSeen,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: InsightsConfig
  sourcesSeen: string[]
  onSave: (
    patch: Partial<InsightsConfig>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const { t } = useTranslation('thinkzap/insights')
  const [draft, setDraft] = useState<Draft>(() => toDraft(config))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sources = [...new Set([...sourcesSeen, ...config.sources])]

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const result = await onSave({
      refMin: Number(draft.refMin),
      bhStart: Number(draft.bhStart),
      bhEnd: Number(draft.bhEnd),
      stuckDays: Number(draft.stuckDays),
      dealWindowDays: Number(draft.dealWindowDays),
      bhDays: [...draft.bhDays].sort((a, b) => a - b),
      bizOnly: draft.bizOnly,
      sources: draft.sources,
    })
    setSaving(false)
    if (result.ok) onOpenChange(false)
    else setError(result.error)
  }

  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form
          onSubmit={e => void handleSubmit(e)}
          className="flex min-h-0 flex-col"
        >
          <DialogHeader>
            <DialogTitle>{t('settings.title')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-5">
            <label className="grid gap-1 text-sm font-semibold">
              {t('settings.refMin')}
              <span className="flex items-center gap-2 font-normal">
                <Input
                  type="number"
                  min={1}
                  className={numberField}
                  value={draft.refMin}
                  onChange={e => set({ refMin: e.target.value })}
                />
                {t('settings.minutes')}
              </span>
              <small className="font-normal text-muted-foreground">
                {t('settings.refMinHint')}
              </small>
            </label>

            <div className="grid gap-1 text-sm font-semibold">
              {t('settings.businessHours')}
              <span className="flex items-center gap-2 font-normal">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  aria-label={t('settings.bhStart')}
                  className={numberField}
                  value={draft.bhStart}
                  onChange={e => set({ bhStart: e.target.value })}
                />
                {t('settings.hoursTo')}
                <Input
                  type="number"
                  min={1}
                  max={24}
                  aria-label={t('settings.bhEnd')}
                  className={numberField}
                  value={draft.bhEnd}
                  onChange={e => set({ bhEnd: e.target.value })}
                />
                h
              </span>
            </div>

            <fieldset className="grid gap-1 text-sm">
              <legend className="mb-1 font-semibold">
                {t('settings.days')}
              </legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                  <label key={d} className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={draft.bhDays.includes(d)}
                      onChange={() => set({ bhDays: toggle(draft.bhDays, d) })}
                    />
                    {t(`weekdays.${d}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={draft.bizOnly}
                onChange={e => set({ bizOnly: e.target.checked })}
              />
              <span>
                {t('settings.bizOnly')}
                <small className="block text-muted-foreground">
                  {t('settings.bizOnlyHint')}
                </small>
              </span>
            </label>

            <label className="grid gap-1 text-sm font-semibold">
              {t('settings.stuckDays')}
              <span className="flex items-center gap-2 font-normal">
                <Input
                  type="number"
                  min={1}
                  className={numberField}
                  value={draft.stuckDays}
                  onChange={e => set({ stuckDays: e.target.value })}
                />
                {t('settings.daysOpen')}
              </span>
            </label>

            <label className="grid gap-1 text-sm font-semibold">
              {t('settings.dealWindow')}
              <span className="flex items-center gap-2 font-normal">
                <Input
                  type="number"
                  min={0}
                  className={numberField}
                  value={draft.dealWindowDays}
                  onChange={e => set({ dealWindowDays: e.target.value })}
                />
                {t('settings.daysAfter')}
              </span>
              <small className="font-normal text-muted-foreground">
                {t('settings.dealWindowHint')}
              </small>
            </label>

            <fieldset className="grid gap-1 text-sm">
              <legend className="mb-1 font-semibold">
                {t('settings.sources')}
              </legend>
              {sources.length ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {sources.map(s => (
                    <label key={s} className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={draft.sources.includes(s)}
                        onChange={() =>
                          set({ sources: toggle(draft.sources, s) })
                        }
                      />
                      {s}
                    </label>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t('settings.noSources')}
                </span>
              )}
              <small className="text-muted-foreground">
                {t('settings.sourcesHint')}
              </small>
            </fieldset>

            {error ? <ErrorBox message={error} /> : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('settings.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('settings.saving') : t('settings.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
