'use client'

import { DoorOpen, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { BotFlowGraph, FlowSettings } from '@/shared/thinkzap-bot-flow'
import { shouldWhisperSummary } from '@/shared/thinkzap-bot-flow'
import { HandoffTargetField } from './handoff-target-field'

/** Palavra sem alvo (e alvo sem palavra) não faz nada — daí o aviso em vez de lista morta. */
export function FlowSettingsCard({
  graph,
  onChange,
  onClose,
}: {
  graph: BotFlowGraph
  onChange: (settings: FlowSettings) => void
  /** O botão da barra também fecha, mas ninguém lê um botão aceso como "fechar". */
  onClose?: () => void
}) {
  const { t } = useTranslation('thinkzap/bots/ajustes')
  const { escapeKeywords, escapeTarget, escapeText } = graph.settings
  const sussurra = shouldWhisperSummary(graph.settings)

  // Metade preenchida é a única configuração inútil: as duas vazias é a saída desligada,
  // que é o estado normal de um fluxo novo.
  const aviso =
    escapeTarget === null && escapeKeywords.length > 0
      ? t('avisoSemAlvo')
      : escapeTarget !== null && escapeKeywords.length === 0
        ? t('avisoSemPalavra')
        : null

  function addKeyword(raw: string) {
    const keyword = raw.trim().toLowerCase()
    if (!keyword || escapeKeywords.includes(keyword)) return
    if (escapeKeywords.length >= 20) return
    onChange({
      ...graph.settings,
      escapeKeywords: [...escapeKeywords, keyword],
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {/* Título + divisória: sem uma linha de cabeçalho para ancorar, o botão de fechar
          ficava solto entre os campos e ninguém o lia como ação do painel. */}
      <header className="flex items-center gap-2 border-b border-border pb-2">
        <h2 className="text-sm font-semibold text-foreground">{t('titulo')}</h2>

        {onClose ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('fechar')}
            title={t('fechar')}
            onClick={onClose}
          >
            <X />
          </Button>
        ) : null}
      </header>

      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        <DoorOpen className="h-3 w-3" />
        {t('saidaEmergencia')}
      </span>

      <p className="text-xs text-muted-foreground">{t('descricao')}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {escapeKeywords.map(keyword => (
          <span
            key={keyword}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
          >
            {keyword}
            <button
              type="button"
              aria-label={t('removerPalavra', { palavra: keyword })}
              className="cursor-pointer text-muted-foreground hover:text-destructive"
              onClick={() =>
                onChange({
                  ...graph.settings,
                  escapeKeywords: escapeKeywords.filter(k => k !== keyword),
                })
              }
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <Input
          placeholder={t('novaPalavra')}
          className="h-7 w-32 text-xs md:text-xs"
          disabled={escapeKeywords.length >= 20}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            addKeyword(event.currentTarget.value)
            event.currentTarget.value = ''
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <HandoffTargetField
          bordered={false}
          noneLabel={t('semSaida')}
          target={escapeTarget}
          onChange={target =>
            onChange({ ...graph.settings, escapeTarget: target })
          }
        />

        {escapeTarget ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              {t('mensagemTransferencia')}
            </span>
            <Input
              placeholder={t('mensagemPlaceholder')}
              // `md:text-xs` porque o `md:text-sm` do `Input` vence um `text-xs` solto.
              className="h-8 text-xs md:text-xs"
              defaultValue={escapeText ?? ''}
              onBlur={event => {
                const texto = event.currentTarget.value.trim()
                onChange({
                  ...graph.settings,
                  escapeText: texto ? texto : undefined,
                })
              }}
            />
          </div>
        ) : null}
      </div>

      {aviso ? (
        <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700">
          {aviso}
        </p>
      ) : null}

      {/* Divisória: vale para toda transferência, não só para a do escape. */}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Switch
          id="whisper-summary"
          checked={sussurra}
          onCheckedChange={checked =>
            onChange({ ...graph.settings, whisperSummary: checked })
          }
        />

        <label
          htmlFor="whisper-summary"
          className="cursor-pointer text-xs font-medium text-foreground"
        >
          {t('resumoSussurro')}
        </label>

        {/* Balão próprio: o `title` nativo abre junto do cursor e saía da tela. */}
        <span className="group/dica relative flex">
          <button
            type="button"
            aria-label={t('resumoSussurroAjuda')}
            className="cursor-help text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
          >
            <Info className="h-3.5 w-3.5" />
          </button>

          {/* `right-0`: abre para a esquerda, que é onde há espaço. */}
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-56 rounded-lg border border-border bg-popover p-2 text-[11px] leading-snug font-normal text-popover-foreground shadow-md group-hover/dica:block group-focus-within/dica:block"
          >
            {t('resumoSussurroAjuda')}
          </span>
        </span>
      </div>
    </section>
  )
}
