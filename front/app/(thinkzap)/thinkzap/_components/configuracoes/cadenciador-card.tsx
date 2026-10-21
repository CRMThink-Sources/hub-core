'use client'

import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CadenceState } from '@/app/hooks/use-line-api'
import { ConfigCard } from './config-card'
import {
  camposInvalidosCadencia,
  type CadenciaEditavel,
} from './limites-alteracoes'

type Props = {
  cadencia: CadenciaEditavel
  onChange: (patch: Partial<CadenciaEditavel>) => void
  /** Estado lido da api; `null` = não pôde ser lido agora (o card segue editável). */
  estado: CadenceState | null
  bloqueada: boolean
}

/** HH:mm do horário de Brasília — o mesmo dos avisos do servidor. */
export function horaDe(epochMs: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(epochMs))
}

/**
 * Cadenciador da linha não oficial (Z-API): no máximo N mensagens por janela de D
 * minutos, com pausa opcional de P minutos. O excesso **não é recusado** — espera na
 * fila e sai na próxima janela.
 *
 * Os campos entram na barra de salvamento da aba. Mudanças só valem a partir da
 * próxima janela, e o card diz isso.
 */
export function CadenciadorCard({
  cadencia,
  onChange,
  estado,
  bloqueada,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/limites')
  const invalidos = camposInvalidosCadencia(cadencia)
  const indisponivel = estado !== null && !estado.available
  /** Indisponível trava só o ligar: quem já tinha ligado ainda consegue desligar. */
  const travado = bloqueada || (indisponivel && !cadencia.ativo)
  const camposTravados = bloqueada || !cadencia.ativo

  return (
    <ConfigCard
      title={t('cadenciador.titulo')}
      description={t('cadenciador.descricao')}
    >
      <div className="flex flex-col gap-5">
        {indisponivel && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-sm">{t('cadenciador.indisponivel')}</p>
          </div>
        )}

        <Toggle
          id="cadence-enabled"
          checked={cadencia.ativo}
          disabled={travado}
          onChange={ativo => onChange({ ativo })}
          label={t('cadenciador.ativar')}
          hint={t('cadenciador.ativarHint')}
        />

        <div className="flex flex-wrap gap-6">
          <Campo
            id="cadence-max-messages"
            label={t('cadenciador.mensagens')}
            valor={cadencia.mensagens}
            disabled={camposTravados}
            invalido={invalidos.mensagens}
            onChange={mensagens => onChange({ mensagens })}
            erro={t('cadenciador.valorInvalido')}
          />
          <Campo
            id="cadence-window-minutes"
            label={t('cadenciador.janela')}
            valor={cadencia.janela}
            disabled={camposTravados}
            invalido={invalidos.janela}
            onChange={janela => onChange({ janela })}
            erro={t('cadenciador.valorInvalido')}
          />
        </div>

        <Toggle
          id="cadence-pause-enabled"
          checked={cadencia.pausaAtiva}
          disabled={camposTravados}
          onChange={pausaAtiva => onChange({ pausaAtiva })}
          label={t('cadenciador.pausa')}
          hint={t('cadenciador.pausaHint')}
        />

        <Campo
          id="cadence-pause-minutes"
          label={t('cadenciador.duracaoPausa')}
          valor={cadencia.pausa}
          disabled={camposTravados || !cadencia.pausaAtiva}
          invalido={invalidos.pausa}
          onChange={pausa => onChange({ pausa })}
          erro={t('cadenciador.valorInvalido')}
        />

        <p className="text-sm text-muted-foreground">
          {t('cadenciador.proximaJanela')}
        </p>

        <EstadoAtual estado={estado} />
      </div>
    </ConfigCard>
  )
}

function EstadoAtual({ estado }: { estado: CadenceState | null }) {
  const { t } = useTranslation('thinkzap/configuracoes/limites')

  if (estado === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('cadenciador.estadoIndisponivel')}
      </p>
    )
  }

  const linha =
    estado.phase === 'paused' && estado.pauseUntil !== null
      ? t('cadenciador.emPausa', { hora: horaDe(estado.pauseUntil) })
      : estado.phase === 'window' &&
          estado.max !== null &&
          estado.windowEndsAt !== null
        ? t('cadenciador.janelaAtiva', {
            count: estado.count,
            max: estado.max,
            hora: horaDe(estado.windowEndsAt),
          })
        : t('cadenciador.semJanela')

  return (
    <div
      className={
        estado.phase === 'paused'
          ? 'rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900'
          : 'rounded-lg border border-border bg-muted/40 p-4'
      }
      data-testid="cadencia-estado"
    >
      <p className="text-sm font-medium">{linha}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('cadenciador.aguardando', { count: estado.waiting })}
      </p>
      {estado.nextWindowChanges && (
        <p className="mt-1 text-sm text-muted-foreground">
          {t('cadenciador.alteracaoPendente')}
        </p>
      )}
    </div>
  )
}

function Campo({
  id,
  label,
  valor,
  disabled,
  invalido,
  onChange,
  erro,
}: {
  id: string
  label: string
  valor: string
  disabled: boolean
  invalido: boolean
  onChange: (valor: string) => void
  erro: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={valor}
        disabled={disabled}
        aria-invalid={invalido || undefined}
        onChange={e => onChange(e.target.value)}
        className="max-w-40"
      />
      {invalido && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  )
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  id: string
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={next => onChange(next === true)}
      />
      <div className="min-w-0">
        <Label
          htmlFor={id}
          className={disabled ? 'text-muted-foreground' : undefined}
        >
          {label}
        </Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}
