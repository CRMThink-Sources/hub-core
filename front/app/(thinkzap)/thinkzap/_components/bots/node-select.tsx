'use client'

import { useTranslation } from 'react-i18next'
import type {
  BotFlowGraph,
  FlowNodeKind,
  NodeId,
} from '@/shared/thinkzap-bot-flow'

/**
 * `<select>` nativo, não o `Select` do kit: o editor tem um por saída de nó, e o kit
 * montaria um portal por instância.
 */
export function NodeSelect({
  graph,
  value,
  onChange,
  exclude,
  label,
  allowEmpty,
}: {
  graph: BotFlowGraph
  value: NodeId
  onChange: (next: NodeId) => void
  /** Normalmente o próprio nó: apontar para si mesmo é laço garantido. */
  exclude?: NodeId
  label?: string
  /** Rótulo da opção vazia. Ausente = escolha obrigatória. */
  allowEmpty?: string
}) {
  const { t } = useTranslation('thinkzap/bots/bloco')
  const { t: tc } = useTranslation('thinkzap/bots/comum')
  const options = graph.nodes.filter(node => node.id !== exclude)
  const orphan = value.length > 0 && !graph.nodes.some(n => n.id === value)

  return (
    <label className="flex min-w-0 items-center gap-1.5">
      {label ? (
        <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      ) : null}
      <select
        value={value}
        aria-invalid={orphan || undefined}
        onChange={event => onChange(event.target.value)}
        className="h-8 min-w-0 flex-1 cursor-pointer rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
      >
        {/* Destino apagado fica visível como opção quebrada. */}
        {allowEmpty ? <option value="">{allowEmpty}</option> : null}
        {orphan ? (
          <option value={value}>
            ⚠ {value} {t('destinoInexistente')}
          </option>
        ) : null}
        {options.map(node => (
          <option key={node.id} value={node.id}>
            {nodeTitle(graph, node.id, kind => tc(`tipos.${kind}`))}
          </option>
        ))}
      </select>
    </label>
  )
}

/** `2 · Pergunta — "O que você quer fazer?"`, truncado. */
export function nodeTitle(
  graph: BotFlowGraph,
  nodeId: NodeId,
  /** Rótulo traduzido do tipo — o `t` do namespace `thinkzap/bots/comum`. */
  tipo: (kind: FlowNodeKind) => string,
): string {
  const index = graph.nodes.findIndex(node => node.id === nodeId)
  const node = graph.nodes[index]
  if (!node) return nodeId

  const kind = tipo(node.kind)
  // Nome do bloco ganha do texto: é o rótulo que o usuário escolheu.
  const base =
    node.name?.trim() || ('text' in node && node.text ? node.text : '')
  const resumo = base.length > 40 ? `${base.slice(0, 40)}…` : base

  return resumo
    ? `${index + 1} · ${kind} — ${resumo}`
    : `${index + 1} · ${kind}`
}
