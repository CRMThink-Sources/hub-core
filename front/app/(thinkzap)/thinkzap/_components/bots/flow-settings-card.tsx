'use client'

import { DoorOpen, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { BotFlowGraph, FlowSettings } from '@/shared/thinkzap-bot-flow'
import { HandoffTargetField } from './handoff-target-field'

/** Palavra sem alvo (e alvo sem palavra) não faz nada — daí o aviso em vez de lista morta. */
export function FlowSettingsCard({
  graph,
  onChange,
}: {
  graph: BotFlowGraph
  onChange: (settings: FlowSettings) => void
}) {
  const { escapeKeywords, escapeTarget, escapeText } = graph.settings

  // Metade preenchida é a única configuração inútil: as duas vazias é a saída desligada,
  // que é o estado normal de um fluxo novo.
  const aviso =
    escapeTarget === null && escapeKeywords.length > 0
      ? 'As palavras acima não têm efeito enquanto nada estiver escolhido em "Transferir para".'
      : escapeTarget !== null && escapeKeywords.length === 0
        ? 'Sem nenhuma palavra, a saída de emergência nunca é acionada.'
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
      <header className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          <DoorOpen className="h-3 w-3" />
          Saída de emergência
        </span>
      </header>

      <p className="text-xs text-muted-foreground">
        Se o cliente escrever uma destas palavras em qualquer ponto, o bot para
        na hora e transfere a conversa.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {escapeKeywords.map(keyword => (
          <span
            key={keyword}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
          >
            {keyword}
            <button
              type="button"
              aria-label={`Remover ${keyword}`}
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
          placeholder="Nova palavra..."
          className="h-7 w-32 text-xs"
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
          title="Transferir para"
          bordered={false}
          noneLabel="não usar saída de emergência"
          target={escapeTarget}
          onChange={target =>
            onChange({ ...graph.settings, escapeTarget: target })
          }
        />

        {escapeTarget ? (
          <Input
            placeholder="fala antes de transferir (opcional)"
            className="h-8 text-xs"
            defaultValue={escapeText ?? ''}
            onBlur={event => {
              const texto = event.currentTarget.value.trim()
              onChange({
                ...graph.settings,
                escapeText: texto ? texto : undefined,
              })
            }}
          />
        ) : null}
      </div>

      {aviso ? (
        <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700">
          {aviso}
        </p>
      ) : null}
    </section>
  )
}
