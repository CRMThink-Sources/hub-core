'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, LayoutGrid, Plus, Save, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getBotFlow,
  publishBotFlow,
  updateBotFlow,
} from '../../_lib/bot-flow-client'
import type {
  BotFlow,
  BotFlowGraph,
  FlowIssue,
  FlowNode,
  FlowNodeKind,
  NodeId,
} from '@/shared/thinkzap-bot-flow'
import { NODE_RECIPES, makeNode, nextNodeId } from '@/shared/thinkzap-bot-flow'
import { setPortTarget } from '@/shared/thinkzap-flow-graph'
import {
  NODE_WIDTH,
  nextFreePosition,
  readingOrder,
  relayout,
  topFromCenter,
  withPositions,
} from '@/shared/thinkzap-flow-layout'
import { FlowCanvas, type FlowCanvasApi } from './canvas/flow-canvas'
import { KindMenu } from './canvas/kind-menu'
import { flowVars } from '@/shared/thinkzap-flow-vars'
import { BlockPanel } from './block-panel'
import { FlowSettingsCard } from './flow-settings-card'
import { BotFlowSimulator } from './bot-flow-simulator'
import { issueText } from './issue-text'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; flow: BotFlow }

export function BotFlowEditor({
  flowId,
  onClose,
}: {
  flowId: string
  onClose: () => void
}) {
  const { t } = useTranslation('thinkzap/bots/editor')
  const { t: tc } = useTranslation('thinkzap/bots/comum')
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [graph, setGraph] = useState<BotFlowGraph | null>(null)
  const [name, setName] = useState('')
  const [issues, setIssues] = useState<FlowIssue[]>([])
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  // `null` = só o canvas. A edição do bloco mora no popover, não aqui.
  const [painel, setPainel] = useState<'simulador' | 'ajustes' | null>(null)
  const [selecionado, setSelecionado] = useState<NodeId | null>(null)
  // Bloco solto, sem ligação: o `+` da saída sempre nasce ligado a algo, e sem isto
  // não haveria como começar quando nenhuma saída livre está na tela.
  const [menuSolto, setMenuSolto] = useState(false)
  /** Preenchido pelo canvas: é quem sabe para onde o usuário está olhando. */
  const canvas = useRef<FlowCanvasApi | null>(null)

  useEffect(() => {
    let ativo = true

    void (async () => {
      try {
        const { flow } = await getBotFlow(flowId)
        if (!ativo) return
        setState({ kind: 'ready', flow })
        // Fluxo sem coordenada abre organizado em vez de empilhado na origem.
        setGraph(withPositions(flow.graph))
        setName(flow.name)
        // Os problemas da abertura não são mostrados: fluxo recém-criado nasce incompleto
        // por definição, e abrir tudo em vermelho acusa o usuário de um erro que é só o
        // trabalho ainda não feito. Quem os traz é salvar ou publicar.
      } catch (error) {
        if (!ativo) return
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : t('erro.carregar'),
        })
      }
    })()

    return () => {
      ativo = false
    }
  }, [flowId, t])

  const issuesByNode = useMemo(() => {
    const map = new Map<NodeId, FlowIssue[]>()
    for (const issue of issues) {
      if (!issue.nodeId) continue
      map.set(issue.nodeId, [...(map.get(issue.nodeId) ?? []), issue])
    }
    return map
  }, [issues])

  const globalIssues = useMemo(
    () => issues.filter(issue => !issue.nodeId),
    [issues],
  )

  // Limpa os problemas: eles vêm do servidor e descrevem o grafo daquele momento, então
  // depois de editar apontariam erro num estado que já não existe.
  const mutate = useCallback((next: BotFlowGraph) => {
    setGraph(next)
    setSujo(true)
    setIssues([])
  }, [])

  const selecionar = useCallback((id: NodeId | null) => setSelecionado(id), [])

  const destinos = useMemo(() => {
    if (!graph) return []
    const ordens = readingOrder(graph)

    return (
      graph.nodes
        .map(node => {
          // Nome dado pelo usuário ganha do texto: é para isso que ele serve.
          const base =
            node.name?.trim() || ('text' in node && node.text ? node.text : '')
          const resumo = base.length > 22 ? `${base.slice(0, 22)}…` : base
          const ordem = ordens.get(node.id) ?? 0
          return {
            id: node.id,
            ordem,
            rotulo: `${ordem}. ${resumo || tc(`tipos.${node.kind}`)}`,
          }
        })
        // Lista na ordem da conversa: procurar destino pelo número exige que ele ordene.
        .sort((a, b) => a.ordem - b.ordem)
    )
  }, [graph, tc])

  /** Bloco solto: saídas pendentes, no meio da tela. Sem canvas montado, à direita. */
  const adicionarSolto = useCallback(
    (kindOuFabrica: FlowNodeKind | ((id: NodeId) => FlowNode)) => {
      if (!graph) return
      const id = nextNodeId(graph)
      const criado =
        typeof kindOuFabrica === 'function'
          ? kindOuFabrica(id)
          : makeNode(kindOuFabrica, id)

      const centro = canvas.current?.centro()
      // Sem desviar de colisão: sobreposto o usuário arrasta, longe ele não acha.
      const position = centro
        ? {
            x: centro.x - NODE_WIDTH / 2,
            y: topFromCenter(criado, centro.y),
          }
        : nextFreePosition(graph)

      mutate({ ...graph, nodes: [...graph.nodes, { ...criado, position }] })
      setSelecionado(id)
    },
    [graph, mutate],
  )

  const nodeSelecionado = useMemo(
    () => graph?.nodes.find(node => node.id === selecionado) ?? null,
    [graph?.nodes, selecionado],
  )

  async function salvar() {
    if (!graph) return
    setSalvando(true)
    try {
      const { flow, issues: found } = await updateBotFlow(flowId, {
        name,
        graph,
      })
      setState({ kind: 'ready', flow })
      setIssues(found)
      setSujo(false)
      toast.success(t('toast.rascunhoSalvo'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('toast.salvarFalhou'),
      )
    } finally {
      setSalvando(false)
    }
  }

  async function publicar() {
    if (!graph) return
    setPublicando(true)
    try {
      // Salva antes: publicar o que está no banco poria no ar o que a tela não mostra.
      const { flow: salvo, issues: found } = await updateBotFlow(flowId, {
        name,
        graph,
      })
      setState({ kind: 'ready', flow: salvo })
      setIssues(found)
      setSujo(false)

      const flow = await publishBotFlow(flowId)
      setState({ kind: 'ready', flow })
      setIssues([])
      toast.success(t('toast.publicado'))
    } catch (error) {
      const found =
        error && typeof error === 'object' && 'issues' in error
          ? ((error as { issues?: FlowIssue[] }).issues ?? [])
          : []
      if (found.length > 0) setIssues(found)
      toast.error(
        error instanceof Error ? error.message : t('toast.publicarFalhou'),
      )
    } finally {
      setPublicando(false)
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="animate-pulse text-sm font-medium text-muted-foreground">
          {t('carregando')}
        </span>
      </div>
    )
  }

  if (state.kind === 'error' || !graph) {
    return (
      <div className="mx-auto mt-10 max-w-2xl px-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">{t('erro.titulo')}</p>
          <p className="mt-1 text-sm">
            {state.kind === 'error' ? state.message : t('erro.semConteudo')}
          </p>
        </div>
        <Button variant="outline" className="mt-4" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          {t('voltar')}
        </Button>
      </div>
    )
  }

  const bloqueada = issues.length > 0

  return (
    <div className="flex w-full flex-col gap-3 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t('voltar')}
        >
          <ArrowLeft />
        </Button>
        <Input
          value={name}
          maxLength={120}
          className="h-9 max-w-xs font-medium"
          onChange={event => {
            setName(event.target.value)
            setSujo(true)
          }}
        />
        {/* Só o aviso de pendência: versão e situação são vocabulário de quem versiona
            fluxo, e na tela de edição não mudavam nenhuma decisão de quem está montando. */}
        {sujo ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t('naoSalvo')}
          </span>
        ) : null}

        <span className="mx-1 h-5 w-px bg-border" />

        {/* Criação e arranjo ficam junto do nome: duas barras empilhadas comiam altura
            do canvas e separavam ações que se usam na mesma hora. */}
        <div className="relative">
          {/* Sólido: é a ação principal do editor, e `outline` sumia contra o `bg-card`. */}
          <Button size="sm" onClick={() => setMenuSolto(atual => !atual)}>
            <Plus className="h-3.5 w-3.5" />
            {t('novoBloco')}
          </Button>
          {menuSolto ? (
            <div className="absolute left-0 top-full z-20 mt-1.5">
              <KindMenu
                onEscolher={kind => {
                  setMenuSolto(false)
                  adicionarSolto(kind)
                }}
                onEscolherReceita={recipeId => {
                  const receita = NODE_RECIPES.find(
                    atual => atual.id === recipeId,
                  )
                  if (!receita) return
                  setMenuSolto(false)
                  // Nome traduzido: `make` nasce com o rótulo em português.
                  adicionarSolto(id => ({
                    ...receita.make(id),
                    name: tc(`receitas.${receita.id}.label`),
                  }))
                }}
                onFechar={() => setMenuSolto(false)}
              />
            </div>
          ) : null}
        </div>

        {/* `border-border` some contra o `bg-card`: os dois são quase o mesmo tom. */}
        <Button
          variant="outline"
          size="sm"
          className="border-foreground/20"
          onClick={() => mutate(relayout(graph))}
          title={t('reorganizarDica')}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {t('reorganizar')}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['simulador', 'ajustes'] as const).map(aba => (
              <button
                key={aba}
                type="button"
                onClick={() => setPainel(painel === aba ? null : aba)}
                className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                  painel === aba
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`abas.${aba}`)}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            disabled={salvando || publicando}
            onClick={() => void salvar()}
          >
            <Save className="h-4 w-4" />
            {salvando ? t('salvando') : t('salvar')}
          </Button>
          <Button
            disabled={salvando || publicando || bloqueada}
            onClick={() => void publicar()}
          >
            <Upload className="h-4 w-4" />
            {publicando ? t('publicando') : t('publicar')}
          </Button>
        </div>
      </div>

      {globalIssues.length > 0 ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2">
          <ul className="flex flex-col gap-0.5">
            {globalIssues.map((issue, index) => (
              <li key={index} className="text-xs text-destructive">
                {issueText(issue, code => t(`problemas.${code}`))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={`grid grid-cols-1 gap-3 ${
          painel ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''
        }`}
      >
        <FlowCanvas
          apiRef={canvas}
          graph={graph}
          issuesByNode={issuesByNode}
          onChange={mutate}
          selecionado={selecionado}
          onSelecionar={selecionar}
          editor={
            nodeSelecionado ? (
              <BlockPanel
                node={nodeSelecionado}
                vars={flowVars(graph)}
                isEntry={nodeSelecionado.id === graph.entryNodeId}
                issues={issuesByNode.get(nodeSelecionado.id) ?? []}
                destinos={destinos.filter(
                  destino => destino.id !== nodeSelecionado.id,
                )}
                onFechar={() => setSelecionado(null)}
                onChange={node =>
                  mutate({
                    ...graph,
                    nodes: graph.nodes.map(current =>
                      current.id === node.id ? node : current,
                    ),
                  })
                }
                onSetEntry={() =>
                  mutate({ ...graph, entryNodeId: nodeSelecionado.id })
                }
                onSetTarget={(port, target) =>
                  mutate({
                    ...graph,
                    nodes: graph.nodes.map(current =>
                      current.id === nodeSelecionado.id
                        ? setPortTarget(current, port, target)
                        : current,
                    ),
                  })
                }
              />
            ) : null
          }
        />

        {painel ? (
          <div className="flex flex-col gap-3">
            {painel === 'simulador' ? (
              <BotFlowSimulator graph={graph} onClose={() => setPainel(null)} />
            ) : (
              <FlowSettingsCard
                graph={graph}
                onChange={settings => mutate({ ...graph, settings })}
                onClose={() => setPainel(null)}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
