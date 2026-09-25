'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from '@xyflow/react'
import {
  AlertCircle,
  MessageSquareReply,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FlowIssue, FlowNode } from '@/shared/thinkzap-bot-flow'
import { describeVarTest } from '@/shared/thinkzap-bot-flow'
import type { VarOperator, VarTest } from '@/shared/thinkzap-bot-flow'
import { visibleNodePorts } from '@/shared/thinkzap-flow-graph'
import { nodeCapture } from '@/shared/thinkzap-flow-vars'
import { NODE_HEIGHT, NODE_WIDTH } from '@/shared/thinkzap-flow-layout'
import {
  LANES,
  LANES_POR_LADO,
  SIDES,
  inHandleId,
  lanePercent,
} from '@/shared/thinkzap-flow-sides'
import { KIND_ICON, KIND_ICON_COLOR } from './kind-visual'

const POSITION_OF = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
} as const

/** A faixa que recebe o arrasto — a mesma que uma aresta sozinha usa. */
const MEIO = Math.floor(LANES_POR_LADO / 2)

export type FlowBlockData = {
  node: FlowNode
  isEntry: boolean
  issues: FlowIssue[]
  ordem: number
  /** Abre o menu de tipos para criar o próximo bloco já ligado nesta saída. */
  onAdicionar: (portId: string) => void
  onRemover: () => void
  /** Liga e desliga a captura da resposta. `null` no bloco que não captura. */
  onCapturar: ((capture: string | undefined) => void) | null
}

/** Exportado: o canvas ancora o menu nesta altura, e duplicar desalinhava os dois. */
export const PORT_ROW = 26

/** Diâmetro da bolinha de saída. Entra no `left` para ela ficar sobre a borda. */
const DOT = 10

// Cartão só de leitura: editar é no popover, porque formulário dentro do nó competia
// com ler o fluxo e ligar blocos.
//
// Quatro handles de entrada nomeados (`in:left`…) porque, com um só, a lib ancora toda
// linha no mesmo ponto; a aresta escolhe o dela pela geometria — ver `entrySides`.
export function FlowBlock({ id, data, selected }: NodeProps) {
  const { node, isEntry, issues, ordem, onAdicionar, onRemover, onCapturar } =
    data as unknown as FlowBlockData
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const { t } = useTranslation('thinkzap/bots/editor')
  const { t: tc } = useTranslation('thinkzap/bots/comum')

  const Icon = KIND_ICON[node.kind]
  const ports = visibleNodePorts(node)
  const quebrado = issues.length > 0
  const titulo = node.name?.trim() || tc(`tipos.${node.kind}`)
  const fala = 'text' in node && node.text ? node.text : ''
  const captura = nodeCapture(node)

  /** Cresce só quando as bolinhas não caberiam na borda com folga. */
  const altura =
    Math.max(NODE_HEIGHT, 40 + ports.length * PORT_ROW) + (captura ? 18 : 0)

  // Fecha por posição do clique, e não por `stopPropagation` no menu: o React ouve no
  // root e a ordem contra um listener de `document` não é garantida — o clique no item
  // fechava a gaveta antes de virar ação.
  useEffect(() => {
    if (!menuAberto) return

    const fechar = (event: PointerEvent) => {
      const alvo = event.target as Node | null
      if (!alvo) return setMenuAberto(false)
      // O botão entra na exceção: fechado aqui, o clique dele reabriria em seguida.
      if (menuRef.current?.contains(alvo)) return
      if (botaoRef.current?.contains(alvo)) return
      setMenuAberto(false)
    }

    document.addEventListener('pointerdown', fechar)
    return () => document.removeEventListener('pointerdown', fechar)
  }, [menuAberto])

  /** A lib ancora as portas na altura medida: mudar de altura pede remedir. */
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(id)
  }, [ports.length, altura, id, updateNodeInternals])

  return (
    <div
      className={`group relative border bg-card transition-shadow ${
        menuAberto ? 'rounded-2xl rounded-b-none' : 'rounded-2xl'
      } ${
        quebrado
          ? 'border-destructive/60 shadow-md'
          : selected
            ? 'border-primary shadow-lg ring-2 ring-primary/20'
            : 'border-border shadow-sm hover:shadow-md'
      }`}
      style={{ width: NODE_WIDTH, height: altura }}
    >
      {/* Entradas em faixas por lado: várias arestas chegando pelo mesmo lado
          terminavam no mesmo pixel e ficavam sobrepostas.

          A faixa do meio cobre o cartão inteiro porque é ela que recebe o arrasto —
          mirar a borda pede precisão demais ao soltar. As outras são estreitas e só
          servem de âncora para o traço; `pointer-events-none` as mantém fora do
          caminho do mouse. `z-0` é obrigatório: por cima, engoliam o mouse da bolinha
          de saída. */}
      {SIDES.map(side =>
        LANES.map(lane => {
          const recebeArrasto = lane === MEIO
          const vertical = side === 'left' || side === 'right'
          const posicao = `${lanePercent(lane) * 100}%`

          return (
            <Handle
              key={`${side}:${lane}`}
              id={inHandleId(side, lane)}
              type="target"
              position={POSITION_OF[side]}
              isConnectableStart={false}
              className={
                recebeArrasto
                  ? 'absolute! inset-0! z-0! h-full! w-full! transform-none! rounded-2xl! border-0! bg-transparent! opacity-0! data-[connectingfrom=true]:opacity-100! data-[connectingfrom=true]:bg-primary/10!'
                  : 'pointer-events-none z-0! h-1! w-1! border-0! bg-transparent! opacity-0!'
              }
              style={
                recebeArrasto
                  ? undefined
                  : vertical
                    ? { top: posicao }
                    : { left: posicao }
              }
            />
          )
        }),
      )}

      {isEntry ? (
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
          {t('bloco.inicio')}
        </span>
      ) : (
        <span className="absolute left-2 top-1.5 text-[10px] font-medium tabular-nums text-muted-foreground/40">
          {ordem}
        </span>
      )}

      {quebrado ? (
        <span
          className="absolute right-1.5 top-1.5 text-destructive"
          title={t('bloco.problemas', { count: issues.length })}
        >
          <AlertCircle className="h-4.5 w-4.5" />
        </span>
      ) : null}

      {/* Some quando o cartão não está em foco para não poluir a leitura do fluxo, e
          sai da frente do aviso quando há um. O bloco de início não sai. */}
      {isEntry ? null : (
        <button
          type="button"
          aria-label={t('bloco.excluir')}
          title={t('bloco.excluir')}
          /* `stopPropagation`: sem barrar, o wrapper da lib seleciona o nó junto. */
          onClick={event => {
            event.stopPropagation()
            onRemover()
          }}
          className={`nodrag absolute top-1.5 z-30 h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive ${
            quebrado ? 'right-7' : 'right-1.5'
          } ${selected ? 'flex' : 'hidden group-hover:flex'}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {/* À esquerda da lixeira, que já ocupa a direita junto com o aviso de problema. */}
      {onCapturar ? (
        <div
          className={`absolute top-1.5 z-30 ${
            isEntry
              ? quebrado
                ? 'right-7'
                : 'right-1.5'
              : quebrado
                ? 'right-12'
                : 'right-7'
          }`}
        >
          <button
            ref={botaoRef}
            type="button"
            aria-label={t('bloco.maisOpcoes')}
            title={t('bloco.maisOpcoes')}
            onClick={event => {
              event.stopPropagation()
              setMenuAberto(aberto => !aberto)
            }}
            className={`nodrag h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground ${
              selected || menuAberto ? 'flex' : 'hidden group-hover:flex'
            }`}
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      {/* Colado embaixo e com a largura do cartão: é continuação do bloco, não um balão
          solto sobre o canvas. */}
      {onCapturar && menuAberto ? (
        <div
          ref={menuRef}
          className="nodrag absolute left-0 top-full z-40 w-full overflow-hidden rounded-b-2xl border border-t-0 border-border bg-card shadow-md"
        >
          {/* Interruptor, e não item de menu: a captura é um estado do bloco que fica
              ligado, e o texto sozinho não se lia como algo clicável. */}
          <div
            role="button"
            tabIndex={0}
            /* No `pointerDown`: o canvas seleciona o nó no clique e a gaveta some antes. */
            onPointerDown={event => {
              event.stopPropagation()
              onCapturar(captura ? undefined : 'resposta')
            }}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onCapturar(captura ? undefined : 'resposta')
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
          >
            <MessageSquareReply
              className={`h-3.5 w-3.5 shrink-0 ${
                captura ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
            <span className="flex-1 text-[11px] font-medium text-foreground">
              {t('bloco.capturar')}
            </span>
            <span
              className={`flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                captura ? 'bg-primary' : 'bg-muted-foreground/25'
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                  captura ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </div>
        </div>
      ) : null}

      {/* Centrado: o cartão é lido de relance, não campo por campo. */}
      <div className="flex h-full flex-col items-center justify-center gap-1 px-3.5 pb-2 pt-5 text-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/60">
          <Icon className={`h-4 w-4 ${KIND_ICON_COLOR[node.kind]}`} />
        </span>

        <span className="line-clamp-1 w-full text-[12px] font-semibold leading-tight text-foreground">
          {titulo}
        </span>

        <span
          className={`w-full text-[10px] leading-snug text-muted-foreground ${
            captura ? 'line-clamp-1' : 'line-clamp-2'
          }`}
        >
          {fala || (
            <span className="italic opacity-70">
              {node.kind === 'question'
                ? t('bloco.semPergunta')
                : node.kind === 'condition'
                  ? resumoCondicao(node.branches, {
                      operadores: tc('operadores', {
                        returnObjects: true,
                      }) as Record<VarOperator, string>,
                      variavel: tc('variavel'),
                      semCondicao: t('bloco.semCondicao'),
                    })
                  : t('bloco.semMensagem')}
            </span>
          )}
        </span>

        {captura ? (
          <span className="flex max-w-full items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
            <MessageSquareReply className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{t('bloco.capturaChip')}</span>
          </span>
        ) : null}
      </div>

      {/* Saídas sobre a borda: deslocada para fora, a bolinha caía na camada das arestas
          e o mouse ia para lá. `z-20` as põe acima das entradas. */}
      {ports.map((port, indice) => {
        const pendente = port.target === node.id
        const topo =
          altura / 2 - ((ports.length - 1) * PORT_ROW) / 2 + indice * PORT_ROW

        return (
          <div
            key={port.id}
            className="group/porta absolute z-20 flex items-center"
            style={{
              top: topo,
              // Centrado na borda: metade do controle dentro do cartão, metade fora.
              left: NODE_WIDTH - DOT / 2,
              transform: 'translateY(-50%)',
            }}
          >
            {/* Handle `absolute`, nunca `static`: sem posição ele ignora `z-index`,
                ficava sob as camadas e o arrasto não começava. */}
            <span
              className="relative flex shrink-0 items-center justify-center"
              style={{ width: DOT, height: DOT }}
            >
              {/* Só o desenho: o handle por cima é quem recebe o mouse. */}
              <span
                className={`pointer-events-none absolute inset-0 rounded-full ${
                  pendente ? 'bg-amber-500' : 'bg-primary'
                }`}
              />

              {/* Sem `onClick` próprio: substituiria o connect-on-click da lib.
                  `after` amplia a área de pega. */}
              <Handle
                id={port.id}
                type="source"
                position={Position.Right}
                className="absolute! inset-0! z-10! h-full! w-full! min-h-0! min-w-0! transform-none! border-0! bg-transparent! after:absolute after:-inset-2 after:content-['']"
              />
            </span>

            {/* Ao lado do handle, não sobre ele: em cima tomaria o mouse do arrasto.
                Sempre visível na saída pendente; no hover na ligada, insere no meio. */}
            <button
              type="button"
              aria-label={
                pendente ? t('bloco.adicionarProximo') : t('bloco.inserirAqui')
              }
              title={
                pendente ? t('bloco.adicionarProximo') : t('bloco.inserirEntre')
              }
              /* `stopPropagation`: a lib põe a seleção do nó no wrapper, e sem
                 barrar o clique abria o painel junto com o menu. */
              onClick={event => {
                event.stopPropagation()
                onAdicionar(port.id)
              }}
              className={`nodrag ml-1.5 h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-primary/60 bg-card text-primary transition-colors hover:border-solid hover:bg-primary hover:text-primary-foreground ${
                pendente ? 'flex' : 'hidden group-hover/porta:flex'
              }`}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Primeira condição por extenso, resto contado: o cartão tem duas linhas. */
function resumoCondicao(
  branches: Array<{ when: VarTest }>,
  textos: {
    operadores: Record<VarOperator, string>
    variavel: string
    semCondicao: string
  },
): string {
  const primeira = branches[0]
  if (!primeira) return textos.semCondicao

  const texto = describeVarTest(primeira.when, textos)
  const resto = branches.length - 1

  return resto > 0 ? `${texto} · +${resto}` : texto
}
