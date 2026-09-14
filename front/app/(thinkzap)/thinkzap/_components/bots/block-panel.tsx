'use client'

import { useState } from 'react'
import { Minus, Plus, Trash2, X } from 'lucide-react'
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
import { questionHasInlineOptions } from '@/shared/thinkzap-question-has-options'
import { AliasTagsField } from './alias-tags-field'
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
  onSetEntry,
  onSetTarget,
}: BlockPanelProps) {
  if (!node) return null

  const ports = nodePorts(node)
  const Icon = KIND_ICON[node.kind]

  /**
   * As saídas que **não** aparecem junto do campo que as nomeia.
   *
   * Rótulo e destino da mesma opção ficavam em seções distintas da tela, e casá-los era
   * por ordem: com quatro opções, escolher o destino da segunda era adivinhação. Agora a
   * opção carrega o próprio destino, e aqui sobra só o caminho de exceção.
   */
  const portasRestantes = ports.filter(port => {
    // `exhausted` mora dentro de "Repete Nx" — o destino só faz sentido ao lado do
    // número de tentativas que leva até ele.
    if (port.port.kind === 'exhausted') return false
    if (node.kind === 'question') return port.port.kind !== 'option'
    if (node.kind === 'condition') return port.port.kind !== 'branch'
    return true
  })

  const tituloDasSaidas =
    node.kind === 'condition' ? 'Se nenhuma condição bater' : 'Para onde vai'

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
        {onFechar ? (
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
            rows={3}
            placeholder={
              node.kind === 'question' ? 'No que posso ajudar?' : undefined
            }
            onChange={event => onChange({ ...node, text: event.target.value })}
            className={`${field} resize-none`}
          />
          {/* O motor numera as opções e as anexa a este texto, então quem as digita aqui
              manda a lista duas vezes ao cliente. A dica é permanente e o aviso só aparece
              quando o texto já tem a lista: orientar antes evita o erro, e avisar depois
              alcança o fluxo que já estava salvo assim. */}
          {node.kind === 'question' ? (
            <>
              <span className="text-[10px] text-muted-foreground">
                Só a pergunta: as opções abaixo são numeradas e enviadas junto.
              </span>
              {questionHasInlineOptions(node.text ?? '') ? (
                <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700">
                  Este texto parece já listar as opções. O cliente vai receber a
                  lista duas vezes — apague-a daqui e deixe só em “Opções”.
                </span>
              ) : null}
            </>
          ) : null}
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
          // Sem `noneLabel` o seletor nunca devolve `null`: o bloco exige alvo.
          onChange={target => target && onChange({ ...node, target })}
        />
      ) : null}

      {node.kind === 'question' ? (
        <div className="flex flex-col gap-2">
          <span className={label}>Opções</span>
          {node.options.map((option, index) => (
            <OptionRow
              key={index}
              numero={index + 1}
              rotulo={option.label}
              aliases={option.aliases}
              destino={option.next}
              destinoPendente={option.next === node.id}
              destinos={destinos}
              nodeId={node.id}
              podeRemover={node.options.length > 1}
              onRotulo={valor =>
                onChange({
                  ...node,
                  options: node.options.map((current, i) =>
                    i === index ? { ...current, label: valor } : current,
                  ),
                })
              }
              onAliases={proximos =>
                onChange({
                  ...node,
                  options: node.options.map((current, i) =>
                    i === index
                      ? // `undefined` e não `[]`: o campo é opcional no schema, e a lista
                        // vazia faria todo fluxo salvo carregar uma por opção.
                        {
                          ...current,
                          aliases: proximos.length ? proximos : undefined,
                        }
                      : current,
                  ),
                })
              }
              onDestino={valor => onSetTarget({ kind: 'option', index }, valor)}
              onRemover={() =>
                onChange({
                  ...node,
                  options: node.options.filter((_, i) => i !== index),
                })
              }
            />
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

      {/* "Resposta diferente" fora do ar por ora — `RetrySection` segue no arquivo.
          A saída "não entendeu" continua no cartão, ligável pela bolinha.
      {node.kind === 'question' || node.kind === 'input' ? (
        <RetrySection
          node={node}
          destinos={destinos}
          onChange={onChange}
          onSetTarget={onSetTarget}
        />
      ) : null} */}

      {node.kind === 'condition' ? (
        <div className="flex flex-col gap-2">
          <span className={label}>Condições</span>
          {node.branches.map((_, index) => (
            <ConditionRow
              key={index}
              node={node}
              index={index}
              destinos={destinos}
              onChange={onChange}
              onSetTarget={onSetTarget}
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

      {portasRestantes.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          <span className={label}>{tituloDasSaidas}</span>
          {portasRestantes.map(port => {
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
                  {/* Sempre na lista: escondê-la depois de escolher trancava a saída
                      no primeiro destino até existir um segundo bloco. */}
                  <option value={node.id}>escolher destino…</option>
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

/**
 * O que acontece quando a resposta não casa com nenhuma opção.
 *
 * Estava invisível: `maxAttempts` e `retryText` não tinham campo no painel, então não
 * havia como saber se uma resposta fora das opções repetia a pergunta ou desviava — e
 * `maxAttempts` nascia `3` sem o operador escolher.
 */
function RetrySection({
  node,
  destinos,
  onChange,
  onSetTarget,
}: {
  node: Extract<FlowNode, { kind: 'question' | 'input' }>
  destinos: Array<{ id: string; rotulo: string }>
  onChange: (node: FlowNode) => void
  onSetTarget: (port: PortKind, target: string) => void
}) {
  const pendente = node.onExhausted === node.id

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2.5">
      <span className={label}>Resposta diferente</span>

      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-xs text-foreground/80">
          Repetir a pergunta
        </span>
        <select
          value={node.maxAttempts}
          onChange={event =>
            onChange({ ...node, maxAttempts: Number(event.target.value) })
          }
          className={`${field} w-14 shrink-0 cursor-pointer`}
        >
          {[1, 2, 3, 4, 5].map(valor => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs text-foreground/80">
          {node.maxAttempts === 1 ? 'vez' : 'vezes'}
        </span>
      </div>

      {/* `maxAttempts: 1` desvia na primeira falha e nunca repergunta — o campo de texto
          seria morto. Vazio não silencia: `askText` repete a pergunta original. */}
      {node.maxAttempts > 1 ? (
        <input
          value={node.retryText ?? ''}
          placeholder="vazio = repete a pergunta original"
          onChange={event =>
            onChange({ ...node, retryText: event.target.value || undefined })
          }
          className={field}
        />
      ) : null}

      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[10px] text-muted-foreground">
          depois leva para
        </span>
        <select
          value={node.onExhausted}
          onChange={event =>
            onSetTarget({ kind: 'exhausted' }, event.target.value)
          }
          className={`${field} min-w-0 flex-1 cursor-pointer ${
            pendente ? 'border-amber-500 text-amber-700' : ''
          }`}
        >
          <option value={node.id}>escolher destino…</option>
          {destinos.map(item => (
            <option key={item.id} value={item.id}>
              {item.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * Uma opção da pergunta: o que o cliente responde e para onde isso leva, na mesma linha.
 *
 * Os dois juntos porque são uma decisão só. Separados — rótulo em "Opções", destino em
 * "Para onde vai" — o operador tinha de casar os dois pela ordem, e uma opção sem rótulo
 * virava um "escolher destino…" sem dono na outra seção.
 */
function OptionRow({
  numero,
  rotulo,
  aliases,
  destino,
  destinoPendente,
  destinos,
  nodeId,
  podeRemover,
  onRotulo,
  onAliases,
  onDestino,
  onRemover,
}: {
  numero: number
  rotulo: string
  aliases: string[] | undefined
  destino: string
  destinoPendente: boolean
  destinos: Array<{ id: string; rotulo: string }>
  nodeId: string
  podeRemover: boolean
  onRotulo: (valor: string) => void
  /** Lista já editada pelo campo de etiquetas; quem chama decide o que gravar. */
  onAliases: (proximos: string[]) => void
  onDestino: (valor: string) => void
  onRemover: () => void
}) {
  const palavras = aliases ?? []
  // Fechado quando não há palavra: o campo vazio ocupava uma linha por opção sem dizer
  // nada. Quem já usou abre com elas à vista.
  const [abertas, setAbertas] = useState(palavras.length > 0)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {/* O número é o que o cliente digita: o canal entrega texto puro, sem botão, e a
            numeração da mensagem segue a ordem desta lista. */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
          {numero}
        </span>
        <input
          value={rotulo}
          placeholder="Suporte"
          onChange={event => onRotulo(event.target.value)}
          className={`${field} min-w-0 flex-1`}
        />
        <button
          type="button"
          aria-label="Remover opção"
          disabled={!podeRemover}
          title={
            podeRemover
              ? 'Remover opção'
              : 'A pergunta precisa de ao menos uma opção'
          }
          onClick={onRemover}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* O rótulo sozinho não diz o que o cliente pode digitar: ele lê "Suporte" e
          responde "ajuda". Campo separado porque o rótulo é o texto **exibido** — juntar
          os dois mudaria a mensagem. */}
      <div className="flex flex-col gap-1 pl-6.5">
        <button
          type="button"
          onClick={() => setAbertas(atual => !atual)}
          aria-expanded={abertas}
          className="flex w-fit cursor-pointer items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded border border-border">
            {abertas ? (
              <Minus className="h-2.5 w-2.5" />
            ) : (
              <Plus className="h-2.5 w-2.5" />
            )}
          </span>
          palavras-chave
          {!abertas && palavras.length > 0 ? (
            <span className="rounded bg-primary/10 px-1 font-medium text-primary">
              {palavras.length}
            </span>
          ) : null}
        </button>

        {abertas ? (
          <AliasTagsField aliases={palavras} onChange={onAliases} />
        ) : null}
      </div>

      {/* Em linha própria e não ao lado: os dois campos lado a lado estouravam a largura
          do painel e viravam scroll horizontal. Indentado sob o número, para o par
          "resposta → destino" continuar lendo junto. */}
      <div className="flex items-center gap-1.5 pl-6.5">
        <span className="shrink-0 text-[10px] text-muted-foreground">
          leva para
        </span>
        <select
          value={destino}
          onChange={event => onDestino(event.target.value)}
          className={`${field} min-w-0 flex-1 cursor-pointer ${
            destinoPendente ? 'border-amber-500 text-amber-700' : ''
          }`}
        >
          <option value={nodeId}>escolher destino…</option>
          {destinos.map(item => (
            <option key={item.id} value={item.id}>
              {item.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/** Como `OptionRow`: a condição e o destino dela na mesma caixa, por serem uma decisão só. */
function ConditionRow({
  node,
  index,
  destinos,
  onChange,
  onSetTarget,
}: {
  node: Extract<FlowNode, { kind: 'condition' }>
  index: number
  destinos: Array<{ id: string; rotulo: string }>
  onChange: (node: FlowNode) => void
  onSetTarget: (port: PortKind, target: string) => void
}) {
  const branch = node.branches[index]
  if (!branch) return null

  const semValor = branch.when.op === 'empty' || branch.when.op === 'notEmpty'
  const pendente = branch.next === node.id

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
    <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2">
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
          title={
            node.branches.length === 1
              ? 'A condição precisa de ao menos um teste'
              : 'Remover condição'
          }
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

      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[10px] text-muted-foreground">
          vai para
        </span>
        <select
          value={branch.next}
          onChange={event =>
            onSetTarget({ kind: 'branch', index }, event.target.value)
          }
          className={`${field} min-w-0 flex-1 cursor-pointer ${
            pendente ? 'border-amber-500 text-amber-700' : ''
          }`}
        >
          <option value={node.id}>escolher destino…</option>
          {destinos.map(item => (
            <option key={item.id} value={item.id}>
              {item.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
