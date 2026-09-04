'use client'

import { Plus, Trash2, X } from 'lucide-react'
import type {
  FlowIssue,
  FlowNode,
  InputValidation,
} from '@/shared/thinkzap-bot-flow'
import {
  MAX_QUESTION_OPTIONS,
  NODE_KIND_LABEL,
  VAR_OPERATORS,
  VAR_OPERATOR_LABEL,
  nextOptionValue,
} from '@/shared/thinkzap-bot-flow'
import { nodePorts, type PortKind } from '@/shared/thinkzap-flow-graph'
import { KIND_ACCENT, KIND_ICON } from './canvas/kind-visual'
import { HandoffTargetField } from './handoff-target-field'
import { issueText } from './issue-text'

const VALIDATION_LABEL: Record<InputValidation, string> = {
  text: 'Texto livre',
  email: 'E-mail',
  cpf: 'CPF',
  number: 'Número',
  date: 'Data',
}

const field =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

const label = 'text-[10px] font-semibold uppercase text-muted-foreground'

export type BlockPanelProps = {
  node: FlowNode | null
  /** Fecha o cartão de edição. */
  onFechar?: () => void
  isEntry: boolean
  issues: FlowIssue[]
  destinos: Array<{ id: string; rotulo: string }>
  onChange: (node: FlowNode) => void
  onRemove: () => void
  onSetEntry: () => void
  onSetTarget: (port: PortKind, target: string) => void
}

/**
 * Edição do bloco selecionado.
 *
 * Todo campo que antes ficava dentro do nó mora aqui. O cartão do canvas voltou a ser
 * leitura, e os campos ganharam largura de painel em vez dos 240px de um nó.
 */
export function BlockPanel({
  node,
  onFechar,
  isEntry,
  issues,
  destinos,
  onChange,
  onRemove,
  onSetEntry,
  onSetTarget,
}: BlockPanelProps) {
  if (!node) return null

  const ports = nodePorts(node)
  const Icon = KIND_ICON[node.kind]

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${KIND_ACCENT[node.kind]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          {NODE_KIND_LABEL[node.kind]}
        </span>
        {isEntry ? (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
            início
          </span>
        ) : (
          <button
            type="button"
            onClick={onSetEntry}
            className="cursor-pointer text-[10px] text-muted-foreground hover:text-primary hover:underline"
          >
            tornar início
          </button>
        )}
        <button
          type="button"
          aria-label="Remover bloco"
          title={
            isEntry
              ? 'O bloco de início não pode ser removido'
              : 'Remover bloco'
          }
          onClick={onRemove}
          disabled={isEntry}
          className="ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {onFechar ? (
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-0.5 rounded-md bg-destructive/10 px-2 py-1.5">
          {issues.map((issue, index) => (
            <li key={index} className="text-[10px] text-destructive">
              {issueText(issue)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className={label}>Nome do bloco</span>
        <input
          value={node.name ?? ''}
          placeholder={NODE_KIND_LABEL[node.kind]}
          maxLength={60}
          onChange={event =>
            onChange({ ...node, name: event.target.value || undefined })
          }
          className={field}
        />
      </div>

      {node.kind !== 'condition' ? (
        <div className="flex flex-col gap-1">
          <span className={label}>
            {node.kind === 'question' || node.kind === 'input'
              ? 'O que o bot pergunta'
              : 'O que o bot diz'}
          </span>
          <textarea
            value={node.text ?? ''}
            rows={4}
            onChange={event => onChange({ ...node, text: event.target.value })}
            className={`${field} resize-none`}
          />
        </div>
      ) : null}

      {node.kind === 'input' ? (
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <span className={label}>Guardar em</span>
            <input
              value={node.saveAs}
              placeholder="ex: cpf"
              onChange={event =>
                onChange({ ...node, saveAs: event.target.value })
              }
              className={field}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className={label}>Formato</span>
            <select
              value={node.validate}
              onChange={event =>
                onChange({
                  ...node,
                  validate: event.target.value as InputValidation,
                })
              }
              className={`${field} cursor-pointer`}
            >
              {Object.entries(VALIDATION_LABEL).map(([value, texto]) => (
                <option key={value} value={value}>
                  {texto}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {node.kind === 'handoff' ? (
        <HandoffTargetField
          target={node.target}
          onChange={target => onChange({ ...node, target })}
        />
      ) : null}

      {node.kind === 'question' ? (
        <div className="flex flex-col gap-1.5">
          <span className={label}>Opções</span>
          {node.options.map((option, index) => (
            <div key={index} className="flex items-center gap-1">
              <span className="w-3 shrink-0 text-[10px] font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <input
                value={option.label}
                placeholder="o que o cliente responde"
                onChange={event =>
                  onChange({
                    ...node,
                    options: node.options.map((current, i) =>
                      i === index
                        ? { ...current, label: event.target.value }
                        : current,
                    ),
                  })
                }
                className={`${field} min-w-0 flex-1`}
              />
              <button
                type="button"
                aria-label="Remover opção"
                disabled={node.options.length === 1}
                onClick={() =>
                  onChange({
                    ...node,
                    options: node.options.filter((_, i) => i !== index),
                  })
                }
                className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...node,
                options: [
                  ...node.options,
                  // Pendente (aponta para o próprio bloco): o + da saída liga depois.
                  {
                    label: '',
                    value: nextOptionValue(node.options),
                    next: node.id,
                  },
                ],
              })
            }
            disabled={node.options.length >= MAX_QUESTION_OPTIONS}
            title={
              node.options.length >= MAX_QUESTION_OPTIONS
                ? `Máximo de ${MAX_QUESTION_OPTIONS} opções.`
                : undefined
            }
            className="flex w-fit cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-2.5 w-2.5" />
            opção
          </button>
        </div>
      ) : null}

      {node.kind === 'condition' ? (
        <div className="flex flex-col gap-1.5">
          <span className={label}>Condições</span>
          {node.branches.map((_, index) => (
            <ConditionRow
              key={index}
              node={node}
              index={index}
              onChange={onChange}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...node,
                branches: [
                  ...node.branches,
                  { when: { var: '', op: 'notEmpty' }, next: node.id },
                ],
              })
            }
            className="flex w-fit cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
          >
            <Plus className="h-2.5 w-2.5" />
            condição
          </button>
        </div>
      ) : null}

      {ports.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          <span className={label}>Para onde vai</span>
          {ports.map(port => {
            const pendente = port.target === node.id

            return (
              <div key={port.id} className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">
                  {port.label || 'segue para'}
                </span>
                <select
                  value={port.target}
                  onChange={event => onSetTarget(port.port, event.target.value)}
                  className={`${field} w-37.5 shrink-0 cursor-pointer ${
                    pendente ? 'border-amber-500 text-amber-700' : ''
                  }`}
                >
                  {pendente ? (
                    <option value={node.id}>escolher destino…</option>
                  ) : null}
                  {destinos.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.rotulo}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
          <p className="text-[10px] text-muted-foreground">
            Ou arraste a bolinha da saída até outro bloco no fluxo.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function ConditionRow({
  node,
  index,
  onChange,
}: {
  node: Extract<FlowNode, { kind: 'condition' }>
  index: number
  onChange: (node: FlowNode) => void
}) {
  const branch = node.branches[index]
  if (!branch) return null

  const semValor = branch.when.op === 'empty' || branch.when.op === 'notEmpty'

  function patch(when: Partial<typeof branch.when>) {
    onChange({
      ...node,
      branches: node.branches.map((current, i) =>
        i === index
          ? { ...current, when: { ...current.when, ...when } }
          : current,
      ),
    })
  }

  return (
    <div className="flex items-center gap-1">
      <input
        value={branch.when.var}
        placeholder="variável"
        onChange={event => patch({ var: event.target.value })}
        className={`${field} min-w-0 flex-1`}
      />
      <select
        value={branch.when.op}
        onChange={event =>
          patch({ op: event.target.value as typeof branch.when.op })
        }
        className={`${field} w-19 shrink-0 cursor-pointer`}
      >
        {/* Rótulos vêm do shared: o cartão do canvas resume a condição com os mesmos. */}
        {VAR_OPERATORS.map(op => (
          <option key={op} value={op}>
            {VAR_OPERATOR_LABEL[op]}
          </option>
        ))}
      </select>
      {semValor ? null : (
        <input
          value={branch.when.value ?? ''}
          placeholder="valor"
          onChange={event => patch({ value: event.target.value })}
          className={`${field} w-16 shrink-0`}
        />
      )}
      <button
        type="button"
        aria-label="Remover condição"
        disabled={node.branches.length === 1}
        onClick={() =>
          onChange({
            ...node,
            branches: node.branches.filter((_, i) => i !== index),
          })
        }
        className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}
