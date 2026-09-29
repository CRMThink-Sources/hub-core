'use client'

import { useState } from 'react'
import { DoorOpen, MessagesSquare, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { BotFlowGraph, FlowSettings } from '@/shared/thinkzap-bot-flow'
import { shouldWhisperSummary } from '@/shared/thinkzap-bot-flow'
import { FieldLabel } from './field-label'
import { HandoffTargetField } from './handoff-target-field'
import { HintTooltip } from './hint-tooltip'

/** Palavra sem alvo (e alvo sem palavra) não faz nada — daí o aviso no rótulo. */
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

  // Não há campo salvo: o que está configurado é o que estava ligado.
  const [ligadaAgora, setLigadaAgora] = useState(false)
  const ligada =
    ligadaAgora || escapeTarget !== null || escapeKeywords.length > 0

  function desligar() {
    setLigadaAgora(false)
    onChange({
      ...graph.settings,
      escapeKeywords: [],
      escapeTarget: null,
      escapeText: undefined,
    })
  }

  // Metade preenchida é a única configuração inútil.
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
      {/* Cabeçalho próprio: solto entre os campos, o X não se lia como ação do painel. */}
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

      <SectionHeader
        icon={<DoorOpen className="h-3 w-3" />}
        title={t('saidaEmergencia')}
        hint={t('descricao')}
        checked={ligada}
        onCheckedChange={checked =>
          checked ? setLigadaAgora(true) : desligar()
        }
      />

      {ligada ? (
        <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel hint={t('palavrasAjuda')} warning={aviso}>
              {t('palavras')}
            </FieldLabel>

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
                        escapeKeywords: escapeKeywords.filter(
                          k => k !== keyword,
                        ),
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
          </div>

          <HandoffTargetField
            bordered={false}
            noneLabel={t('selecioneDistribuicao')}
            target={escapeTarget}
            onChange={target =>
              onChange({ ...graph.settings, escapeTarget: target })
            }
          />

          {escapeTarget ? (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('mensagemTransferencia')}</FieldLabel>
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
        </>
      ) : null}

      <SectionHeader
        icon={<MessagesSquare className="h-3 w-3" />}
        title={t('resumoSussurro')}
        hint={t('resumoSussurroAjuda')}
        checked={sussurra}
        onCheckedChange={checked =>
          onChange({ ...graph.settings, whisperSummary: checked })
        }
        bordered
      />
    </section>
  )
}

/** Uma função do fluxo: o que é, o que faz e o interruptor que a liga. */
function SectionHeader({
  icon,
  title,
  hint,
  checked,
  onCheckedChange,
  bordered = false,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Divisória acima, para separar a função da anterior. */
  bordered?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${bordered ? 'border-t border-border pt-3' : ''}`}
    >
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {icon}
        {title}
      </span>

      <HintTooltip text={hint} />

      <Switch
        aria-label={title}
        className="ml-auto"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}
