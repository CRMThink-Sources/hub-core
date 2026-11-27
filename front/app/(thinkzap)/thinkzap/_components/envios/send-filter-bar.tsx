'use client'

import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SEND_PERIOD_PRESETS,
  type SendFilters,
  type SendPeriodPreset,
} from '../../_lib/send-filters'
import { SEND_STATUSES, sendStatusView } from '../../_lib/send-status'
import type { SendListResponse } from '../../_lib/thinkzap-sends-client'
import {
  clearedSendFilters,
  destinationDigits,
  hasActiveFilters,
  isValidCustomRange,
  localDayDaysAgo,
  toLocalDay,
  withFilterChange,
} from './envios-view'

/**
 * Espera do campo de destinatário: cada tecla não vira uma consulta (e uma
 * entrada no histórico do navegador); 400 ms é o intervalo de quem para de
 * digitar.
 */
const DESTINATION_DEBOUNCE_MS = 400
const ALL = 'all'
const CUSTOM = 'custom'

type Props = {
  filters: SendFilters
  /**
   * Recebe a função que monta o novo estado a partir dos filtros ATUAIS da URL
   * (não do último render): duas mudanças rápidas não se sobrescrevem.
   */
  onChange: (update: (current: SendFilters) => SendFilters) => void
  lines: SendListResponse['lines']
  senders: SendListResponse['senders']
  /** Só administrador filtra por remetente (a API ignora o filtro dos demais). */
  showSenderFilter: boolean
  /** Prazo do histórico, para limitar o calendário; `undefined` antes da 1ª resposta. */
  retentionDays: number | undefined
}

export function SendFilterBar({
  filters,
  onChange,
  lines,
  senders,
  showSenderFilter,
  retentionDays,
}: Props) {
  const { t } = useTranslation('thinkzap/envios')
  const id = useId()
  const periodId = `${id}-period`
  const fromId = `${id}-from`
  const toId = `${id}-to`
  const statusId = `${id}-status`
  const lineId = `${id}-line`
  const destinationId = `${id}-destination`
  const destinationHintId = `${id}-destination-hint`
  const senderId = `${id}-sender`
  const rangeErrorId = `${id}-range-error`

  const { period } = filters

  // Rascunho do intervalo: um dia digitado pela metade ou um início depois
  // do fim não vai para a URL (readSendFilters o descartaria e a tela
  // voltaria para 7 dias sem o usuário entender por quê).
  const [rangeDraft, setRangeDraft] = useState(() =>
    period.kind === 'custom' ? { from: period.from, to: period.to } : null,
  )
  useEffect(() => {
    setRangeDraft(
      period.kind === 'custom' ? { from: period.from, to: period.to } : null,
    )
  }, [period])

  // Rascunho do destinatário, com espera; sincroniza quando a URL muda por
  // fora (voltar do navegador, limpar filtros).
  // O campo mantém o que o usuário digitou (máscara, "+"), mas só os dígitos
  // vão para a URL e para a API.
  const [destinationDraft, setDestinationDraft] = useState(
    filters.destination ?? '',
  )
  useEffect(() => {
    setDestinationDraft(current =>
      destinationDigits(current) === filters.destination
        ? current
        : (filters.destination ?? ''),
    )
  }, [filters.destination])
  useEffect(() => {
    const next = destinationDigits(destinationDraft)
    if (next === filters.destination) return
    const timer = setTimeout(() => {
      onChange(current => withFilterChange(current, { destination: next }))
    }, DESTINATION_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [destinationDraft, filters.destination, onChange])
  const destinationHasNoDigits =
    destinationDraft.trim() !== '' &&
    destinationDigits(destinationDraft) === null

  const today = toLocalDay(new Date())
  const earliest = localDayDaysAgo(new Date(), retentionDays ?? 90)
  const rangeInvalid =
    rangeDraft !== null && !isValidCustomRange(rangeDraft.from, rangeDraft.to)

  function changePeriod(value: string | null) {
    if (value === CUSTOM) {
      // Começa do período que estava na tela, para a troca não mudar a lista.
      const days = period.kind === 'preset' ? period.days : 7
      onChange(current =>
        withFilterChange(current, {
          period: {
            kind: 'custom',
            from: localDayDaysAgo(new Date(), days),
            to: today,
          },
        }),
      )
      return
    }
    const days = SEND_PERIOD_PRESETS.find(p => String(p) === value)
    if (days) {
      onChange(current =>
        withFilterChange(current, { period: { kind: 'preset', days } }),
      )
    }
  }

  function changeRange(patch: { from?: string; to?: string }) {
    if (!rangeDraft) return
    const next = { ...rangeDraft, ...patch }
    setRangeDraft(next)
    if (isValidCustomRange(next.from, next.to)) {
      onChange(current =>
        withFilterChange(current, {
          period: { kind: 'custom', from: next.from, to: next.to },
        }),
      )
    }
  }

  const lineName = (value: string) =>
    lines.find(line => line.id === value)?.name ?? value
  const senderName = (value: string) => {
    const name = senders.find(sender => sender.id === value)?.name?.trim()
    return name || t('filters.senderUnnamed', { id: value })
  }

  return (
    <form
      role="search"
      aria-label={t('filters.ariaLabel')}
      className="flex flex-wrap items-end gap-4"
      onSubmit={event => event.preventDefault()}
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={periodId}>{t('filters.period')}</FieldLabel>
        <Select
          value={period.kind === 'custom' ? CUSTOM : String(period.days)}
          onValueChange={(value: string | null) => changePeriod(value)}
        >
          <SelectTrigger id={periodId} className="w-44">
            <SelectValue>
              {(value: string) =>
                value === CUSTOM
                  ? t('filters.periodCustom')
                  : t('filters.periodLast', { days: value })
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SEND_PERIOD_PRESETS.map((days: SendPeriodPreset) => (
              <SelectItem key={days} value={String(days)}>
                {t('filters.periodLast', { days })}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>{t('filters.periodCustom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rangeDraft && (
        <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={fromId}>{t('filters.from')}</FieldLabel>
            <Input
              id={fromId}
              type="date"
              className="w-40"
              min={earliest}
              max={today}
              value={rangeDraft.from}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? rangeErrorId : undefined}
              onChange={event => changeRange({ from: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={toId}>{t('filters.to')}</FieldLabel>
            <Input
              id={toId}
              type="date"
              className="w-40"
              min={earliest}
              max={today}
              value={rangeDraft.to}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? rangeErrorId : undefined}
              onChange={event => changeRange({ to: event.target.value })}
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={statusId}>{t('filters.status')}</FieldLabel>
        <Select
          value={filters.status ?? ALL}
          onValueChange={(value: string | null) => {
            const status = SEND_STATUSES.find(s => s === value) ?? null
            onChange(current => withFilterChange(current, { status }))
          }}
        >
          <SelectTrigger id={statusId} className="w-44">
            <SelectValue>
              {(value: string) =>
                value === ALL
                  ? t('filters.allStatuses')
                  : t(sendStatusView(value).labelKey)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filters.allStatuses')}</SelectItem>
            {SEND_STATUSES.map(status => (
              <SelectItem key={status} value={status}>
                {t(sendStatusView(status).labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={lineId}>{t('filters.line')}</FieldLabel>
        <Select
          value={filters.lineId ?? ALL}
          onValueChange={(value: string | null) =>
            onChange(current =>
              withFilterChange(current, {
                lineId: value && value !== ALL ? value : null,
              }),
            )
          }
        >
          <SelectTrigger id={lineId} className="w-52">
            <SelectValue>
              {(value: string) =>
                value === ALL ? t('filters.allLines') : lineName(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filters.allLines')}</SelectItem>
            {lines.map(line => (
              <SelectItem key={line.id} value={line.id}>
                {line.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={destinationId}>
          {t('filters.destination')}
        </FieldLabel>
        <Input
          id={destinationId}
          type="search"
          inputMode="tel"
          autoComplete="off"
          maxLength={40}
          className="w-52"
          placeholder={t('filters.destinationPlaceholder')}
          aria-describedby={destinationHintId}
          value={destinationDraft}
          onChange={event => setDestinationDraft(event.target.value)}
        />
        <span
          id={destinationHintId}
          className={
            destinationHasNoDigits ? 'text-xs text-destructive' : 'sr-only'
          }
        >
          {destinationHasNoDigits
            ? t('filters.destinationNoDigits')
            : t('filters.destinationHint')}
        </span>
      </div>

      {showSenderFilter && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={senderId}>{t('filters.sender')}</FieldLabel>
          <Select
            value={filters.senderId ?? ALL}
            onValueChange={(value: string | null) =>
              onChange(current =>
                withFilterChange(current, {
                  senderId: value && value !== ALL ? value : null,
                }),
              )
            }
          >
            <SelectTrigger id={senderId} className="w-52">
              <SelectValue>
                {(value: string) =>
                  value === ALL ? t('filters.allSenders') : senderName(value)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allSenders')}</SelectItem>
              {senders.map(sender => (
                <SelectItem key={sender.id} value={sender.id}>
                  {senderName(sender.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasActiveFilters(filters, showSenderFilter) && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDestinationDraft('')
            onChange(() => clearedSendFilters())
          }}
        >
          <XIcon className="size-4" />
          {t('filters.clear')}
        </Button>
      )}

      {rangeInvalid && (
        <p
          id={rangeErrorId}
          role="alert"
          className="basis-full text-sm text-destructive"
        >
          {t('filters.invalidRange')}
        </p>
      )}
    </form>
  )
}
