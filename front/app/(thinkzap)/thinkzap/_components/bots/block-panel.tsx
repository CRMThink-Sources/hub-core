'use client'

import { useState } from 'react'
import { Minus, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FlowIssue, FlowNode } from '@/shared/thinkzap-bot-flow'
import {
  MAX_QUESTION_OPTIONS,
  VAR_OPERATORS,
  nextOptionValue,
} from '@/shared/thinkzap-bot-flow'
import { nodePorts, type PortKind } from '@/shared/thinkzap-flow-graph'
import {
  CAPTURE_NAME_PATTERN,
  CAPTURE_NAMESPACE,
  type FlowVar,
  nextCaptureName,
} from '@/shared/thinkzap-flow-vars'
import { questionHasInlineOptions } from '@/shared/thinkzap-question-has-options'
import { AliasTagsField } from './alias-tags-field'
import { TextWithVars } from './text-with-vars'
import { KIND_ACCENT, KIND_ICON } from './canvas/kind-visual'
import { HandoffTargetField } from './handoff-target-field'
import { issueText } from './issue-text'

/**
 * Sem largura: `w-full` embutido aqui competia com a largura própria de quem precisa de
 * uma (`w-19` no operador da condição, por exemplo). São a mesma propriedade, e quem vence
 * é a ordem do CSS gerado, não a da string — o operador esticava a 100% e esmagava o campo
 * da variável ao lado até sumir. Quem quer ocupar a linha pede `field` mais `w-full`.
 */
const fieldBase =
  'rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

const field = `${fieldBase} w-full`

const label = 'text-[10px] font-semibold uppercase text-muted-foreground'

export type BlockPanelProps = {
  node: FlowNode | null
  /** Fecha o cartão de edição. */
  onFechar?: () => void
  /** Variáveis que o `@` oferece: sistema mais o que os blocos capturam. */
  vars: FlowVar[]
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
  vars,
  isEntry,
  issues,
  destinos,
  onChange,
  onSetEntry,
  onSetTarget,
}: BlockPanelProps) {
  const { t } = useTranslation('thinkzap/bots/bloco')
  const { t: tc } = useTranslation('thinkzap/bots/comum')
  const { t: te } = useTranslation('thinkzap/bots/editor')

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

  /**
   * Uma condição só já são dois caminhos — bate e não bate. Chamar o segundo de "se
   * nenhuma condição bater" fazia parecer que faltava caminho no painel, enquanto o
   * bloco no canvas mostrava as duas saídas.
   */
  const tituloDasSaidas =
    node.kind !== 'condition'
      ? t('saidas.paraOndeVai')
      : node.branches.length === 1
        ? t('saidas.seNaoBater')
        : t('saidas.seNenhuma')

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${KIND_ACCENT[node.kind]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          {tc(`tipos.${node.kind}`)}
        </span>
        {isEntry ? (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
            {t('inicio')}
          </span>
        ) : (
          <button
            type="button"
            onClick={onSetEntry}
            className="cursor-pointer text-[10px] text-muted-foreground hover:text-primary hover:underline"
          >
            {t('tornarInicio')}
          </button>
        )}
        {onFechar ? (
          <button
            type="button"
            aria-label={t('fechar')}
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
              {issueText(issue, code => te(`problemas.${code}`))}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className={label}>{t('nome')}</span>
        <input
          value={node.name ?? ''}
          placeholder={tc(`tipos.${node.kind}`)}
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
            {node.kind === 'question' ? t('perguntaLabel') : t('falaLabel')}
          </span>
          <TextWithVars
            value={node.text ?? ''}
            vars={vars}
            placeholder={
              node.kind === 'question' ? t('perguntaPlaceholder') : undefined
            }
            onChange={text => onChange({ ...node, text })}
            className={`${field} resize-none`}
          />
          {/* O motor numera as opções e as anexa a este texto, então quem as digita aqui
              manda a lista duas vezes ao cliente. A dica é permanente e o aviso só aparece
              quando o texto já tem a lista: orientar antes evita o erro, e avisar depois
              alcança o fluxo que já estava salvo assim. */}
          {node.kind === 'question' ? (
            <>
              <span className="text-[10px] text-muted-foreground">
                {t('dicaOpcoes')}
              </span>
              {questionHasInlineOptions(node.text ?? '') ? (
                <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700">
                  {t('avisoOpcoesNoTexto')}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {node.kind === 'message' || node.kind === 'question' ? (
        <CaptureField node={node} vars={vars} onChange={onChange} />
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
          <span className={label}>{t('opcoes.titulo')}</span>
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
                ? t('opcoes.maximo', { max: MAX_QUESTION_OPTIONS })
                : undefined
            }
            className="flex w-fit cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-2.5 w-2.5" />
            {t('opcoes.adicionar')}
          </button>
        </div>
      ) : null}

      {/* "Resposta diferente" fora do ar por ora — `RetrySection` segue no arquivo.
          A saída "não entendeu" continua no cartão, ligável pela bolinha.
      {node.kind === 'question' ? (
        <RetrySection
          node={node}
          destinos={destinos}
          onChange={onChange}
          onSetTarget={onSetTarget}
        />
      ) : null} */}

      {node.kind === 'condition' ? (
        <div className="flex flex-col gap-2">
          <span className={label}>
            {node.branches.length === 1
              ? t('condicoes.seBater')
              : t('condicoes.titulo')}
          </span>
          {node.branches.map((_, index) => (
            <ConditionRow
              key={index}
              node={node}
              index={index}
              vars={vars}
              destinos={destinos}
              onChange={onChange}
              onSetTarget={onSetTarget}
            />
          ))}
          {/* Bloco de receita responde uma pergunta fechada ("já é cliente?"): uma
              terceira saída não teria o que testar e só quebraria a leitura sim/não. */}
          {node.recipeId ? null : (
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
              {t('condicoes.adicionar')}
            </button>
          )}
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
                  {port.label || t('saidas.segueParaFallback')}
                </span>
                <select
                  value={port.target}
                  onChange={event => onSetTarget(port.port, event.target.value)}
                  className={`${fieldBase} w-37.5 shrink-0 cursor-pointer ${
                    pendente ? 'border-amber-500 text-amber-700' : ''
                  }`}
                >
                  {/* Sempre na lista: escondê-la depois de escolher trancava a saída
                      no primeiro destino até existir um segundo bloco. */}
                  <option value={node.id}>{t('escolherDestino')}</option>
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
            {t('saidas.dicaArrastar')}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Ligar a captura muda o que o bloco faz: a mensagem passa a esperar a resposta antes de
 * seguir. Por isso um botão, e não um campo sempre aberto.
 */
function CaptureField({
  node,
  vars,
  onChange,
}: {
  node: Extract<FlowNode, { kind: 'message' | 'question' }>
  vars: FlowVar[]
  onChange: (node: FlowNode) => void
}) {
  const { t } = useTranslation('thinkzap/bots/bloco')
  const nome = node.capture ?? ''
  const invalido = !!nome && !CAPTURE_NAME_PATTERN.test(nome)

  if (!node.capture) {
    return (
      <button
        type="button"
        onClick={() => onChange({ ...node, capture: nextCaptureName(vars) })}
        className="flex cursor-pointer items-center gap-1.5 self-start text-[11px] text-primary hover:underline"
      >
        <Plus className="h-3 w-3" />
        {t('captura.ativar')}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={label}>{t('captura.titulo')}</span>
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {CAPTURE_NAMESPACE}.
        </span>
        <input
          value={nome}
          placeholder={t('captura.placeholder')}
          onChange={event => onChange({ ...node, capture: event.target.value })}
          className={`${fieldBase} min-w-0 flex-1 ${
            invalido ? 'border-destructive' : ''
          }`}
        />
        <button
          type="button"
          aria-label={t('captura.remover')}
          onClick={() => onChange({ ...node, capture: undefined })}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <span
        className={`text-[10px] ${invalido ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {invalido
          ? t('captura.nomeInvalido')
          : t(
              node.kind === 'question'
                ? 'captura.dicaPergunta'
                : 'captura.dicaMensagem',
              { variavel: `${CAPTURE_NAMESPACE}.${nome}` },
            )}
      </span>
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
  node: Extract<FlowNode, { kind: 'question' }>
  destinos: Array<{ id: string; rotulo: string }>
  onChange: (node: FlowNode) => void
  onSetTarget: (port: PortKind, target: string) => void
}) {
  const { t } = useTranslation('thinkzap/bots/bloco')
  const pendente = node.onExhausted === node.id

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2.5">
      <span className={label}>{t('retry.titulo')}</span>

      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-xs text-foreground/80">
          {t('retry.repetirPergunta')}
        </span>
        <select
          value={node.maxAttempts}
          onChange={event =>
            onChange({ ...node, maxAttempts: Number(event.target.value) })
          }
          className={`${fieldBase} w-14 shrink-0 cursor-pointer`}
        >
          {[1, 2, 3, 4, 5].map(valor => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs text-foreground/80">
          {node.maxAttempts === 1 ? t('retry.vez') : t('retry.vezes')}
        </span>
      </div>

      {/* `maxAttempts: 1` desvia na primeira falha e nunca repergunta — o campo de texto
          seria morto. Vazio não silencia: `askText` repete a pergunta original. */}
      {node.maxAttempts > 1 ? (
        <input
          value={node.retryText ?? ''}
          placeholder={t('retry.placeholder')}
          onChange={event =>
            onChange({ ...node, retryText: event.target.value || undefined })
          }
          className={field}
        />
      ) : null}

      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {t('retry.depoisLevaPara')}
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
          <option value={node.id}>{t('escolherDestino')}</option>
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
  const { t } = useTranslation('thinkzap/bots/bloco')
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
          placeholder={t('opcoes.placeholder')}
          onChange={event => onRotulo(event.target.value)}
          className={`${field} min-w-0 flex-1`}
        />
        <button
          type="button"
          aria-label={t('opcoes.remover')}
          disabled={!podeRemover}
          title={podeRemover ? t('opcoes.remover') : t('opcoes.minima')}
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
          {t('opcoes.palavrasChave')}
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
          {t('opcoes.levaPara')}
        </span>
        <select
          value={destino}
          onChange={event => onDestino(event.target.value)}
          className={`${field} min-w-0 flex-1 cursor-pointer ${
            destinoPendente ? 'border-amber-500 text-amber-700' : ''
          }`}
        >
          <option value={nodeId}>{t('escolherDestino')}</option>
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
  vars,
  destinos,
  onChange,
  onSetTarget,
}: {
  node: Extract<FlowNode, { kind: 'condition' }>
  index: number
  vars: FlowVar[]
  destinos: Array<{ id: string; rotulo: string }>
  onChange: (node: FlowNode) => void
  onSetTarget: (port: PortKind, target: string) => void
}) {
  const { t } = useTranslation('thinkzap/bots/bloco')
  const { t: tc } = useTranslation('thinkzap/bots/comum')
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
      {/* Sozinha na linha: com operador e valor ao lado, o nome truncava em "bitrix.nam". */}
      <div className="flex items-center gap-1">
        {/* Lista, não campo livre: o nome tem namespace (`capture.x`), e digitado na mão
            ele não casa com nada e a condição desvia sempre pelo mesmo lado. */}
        <select
          value={branch.when.var}
          onChange={event => patch({ var: event.target.value })}
          className={`${fieldBase} min-w-0 flex-1 cursor-pointer`}
        >
          <option value="">{t('condicoes.variavelPlaceholder')}</option>
          {/* Variável de fluxo antigo, cujo bloco de origem já não existe. */}
          {branch.when.var &&
          !vars.some(item => item.name === branch.when.var) ? (
            <option value={branch.when.var}>{branch.when.var}</option>
          ) : null}
          {vars.map(item => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={t('condicoes.remover')}
          disabled={node.branches.length === 1}
          title={
            node.branches.length === 1
              ? t('condicoes.minima')
              : t('condicoes.remover')
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

      <div className="flex items-center gap-1">
        <select
          value={branch.when.op}
          onChange={event =>
            patch({ op: event.target.value as typeof branch.when.op })
          }
          // Largura do rótulo mais longo traduzido ("sin valor", "contiene").
          className={`${fieldBase} cursor-pointer ${
            semValor ? 'min-w-0 flex-1' : 'w-24 shrink-0'
          }`}
        >
          {/* Rótulos do namespace comum: o cartão do canvas resume a condição com os mesmos. */}
          {VAR_OPERATORS.map(op => (
            <option key={op} value={op}>
              {tc(`operadores.${op}`)}
            </option>
          ))}
        </select>
        {semValor ? null : (
          <input
            value={branch.when.value ?? ''}
            placeholder={t('condicoes.valorPlaceholder')}
            onChange={event => patch({ value: event.target.value })}
            className={`${fieldBase} min-w-0 flex-1`}
          />
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {t('condicoes.vaiPara')}
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
          <option value={node.id}>{t('escolherDestino')}</option>
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
