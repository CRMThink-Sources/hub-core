'use client'

import { DoorOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BotFlowGraph, FlowSettings } from '@/shared/thinkzap-bot-flow'
import { NodeSelect } from './node-select'

/** Sem `escapeNext` as palavras não fazem nada — daí o aviso em vez de lista morta. */
export function FlowSettingsCard({
  graph,
  onChange,
}: {
  graph: BotFlowGraph
  onChange: (settings: FlowSettings) => void
}) {
  const { escapeKeywords, escapeNext } = graph.settings
  const inerte = escapeNext === null && escapeKeywords.length > 0

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
        Se o cliente escrever uma destas palavras em qualquer ponto, o fluxo
        pula direto para o passo escolhido.
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
          placeholder="nova palavra + Enter"
          className="h-7 w-44 text-xs"
          disabled={escapeKeywords.length >= 20}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            addKeyword(event.currentTarget.value)
            event.currentTarget.value = ''
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NodeSelect
          graph={graph}
          label="Pular para"
          value={escapeNext ?? ''}
          allowEmpty="não usar saída de emergência"
          onChange={next =>
            onChange({
              ...graph.settings,
              escapeNext: next === '' ? null : next,
            })
          }
        />
      </div>

      {inerte ? (
        <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700">
          As palavras acima não têm efeito enquanto nenhum passo estiver
          escolhido em &quot;Pular para&quot;.
        </p>
      ) : null}
    </section>
  )
}
