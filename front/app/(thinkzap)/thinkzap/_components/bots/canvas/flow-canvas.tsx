'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ViewportPortal,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Map as MapIcon, X } from 'lucide-react'
import type {
  BotFlowGraph,
  FlowIssue,
  FlowNode,
  FlowNodeKind,
  NodeId,
} from '@/shared/thinkzap-bot-flow'
import {
  NODE_KIND_LABEL,
  NODE_RECIPES,
  removeNode,
} from '@/shared/thinkzap-bot-flow'
import {
  clearPort,
  isPortRenameable,
  nodePorts,
  parsePortId,
  setPortLabel,
  setPortTarget,
} from '@/shared/thinkzap-flow-graph'
import { canvasEdges, edgesKey } from '@/shared/thinkzap-flow-edges'
import { insertAfter } from '@/shared/thinkzap-flow-insert'
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  readingOrder,
} from '@/shared/thinkzap-flow-layout'
import { FlowBlock, PORT_ROW, type FlowBlockData } from './flow-block'
import { EditableEdge, type EditableEdgeData } from './editable-edge'
import { KindMenu } from './kind-menu'

/** Fora do componente: recriar o mapa a cada render remonta todo bloco/aresta. */
const NODE_TYPES: NodeTypes = { flowBlock: FlowBlock }
const EDGE_TYPES: EdgeTypes = { editable: EditableEdge }

export function FlowCanvas({
  graph,
  issuesByNode,
  onChange,
  selecionado,
  onSelecionar,
  editor,
}: {
  graph: BotFlowGraph
  issuesByNode: Map<NodeId, FlowIssue[]>
  onChange: (graph: BotFlowGraph) => void
  selecionado: NodeId | null
  onSelecionar: (id: NodeId | null) => void
  /** Cartão de edição do bloco selecionado. Vem de fora; aqui só entra o posicionamento. */
  editor?: React.ReactNode
}) {
  // Estado próprio dos nós: durante o arrasto o canvas é a única fonte de posição, e o
  // grafo só recebe no fim — senão o bloco piscava de volta à posição antiga.
  const [nodes, setNodes] = useState<Node[]>([])
  const [mapaAberto, setMapaAberto] = useState(false)
  const arrastando = useRef(false)
  const religou = useRef(false)

  // Fora das deps do efeito das arestas: `onChange` troca de identidade a cada render e
  // reconstruiria a lista sempre — e é nela que a seleção mora.
  const atual = useRef({ graph, onChange })
  atual.current = { graph, onChange }

  /** Saída que pediu bloco novo. Id em vez de elemento: pan/zoom move a âncora. */
  const [criandoEm, setCriandoEm] = useState<{
    nodeId: NodeId
    portId: string
  } | null>(null)

  /** Pelo ref: `onChange` troca de identidade a cada render e remontaria os blocos. */
  const remover = useCallback(
    (nodeId: NodeId) => {
      const { graph: atualGraph, onChange: aplicar } = atual.current
      aplicar(removeNode(atualGraph, nodeId))
      onSelecionar(null)
      setCriandoEm(null)
    },
    [onSelecionar],
  )

  const dados = useCallback(
    (node: FlowNode, ordem: number): FlowBlockData => ({
      node,
      isEntry: node.id === graph.entryNodeId,
      issues: issuesByNode.get(node.id) ?? [],
      ordem,
      // Abrir o menu fecha a edição: os dois ancoram do mesmo lado e se cobrem.
      onAdicionar: portId => {
        onSelecionar(null)
        setCriandoEm({ nodeId: node.id, portId })
      },
      onRemover: () => remover(node.id),
    }),
    [graph.entryNodeId, issuesByNode, onSelecionar, remover],
  )

  /** Cria o bloco escolhido já ligado na saída que pediu, e abre a edição dele. */
  const criar = useCallback(
    (kindOuFabrica: Parameters<typeof insertAfter>[3]) => {
      if (!criandoEm) return
      const port = parsePortId(criandoEm.portId)
      if (!port) return

      const { graph: proximo, nodeId } = insertAfter(
        graph,
        criandoEm.nodeId,
        port,
        kindOuFabrica,
      )
      setCriandoEm(null)
      onChange(proximo)
      onSelecionar(nodeId)
    },
    [criandoEm, graph, onChange, onSelecionar],
  )

  const criarReceita = useCallback(
    (recipeId: string) => {
      const receita = NODE_RECIPES.find(atual => atual.id === recipeId)
      if (receita) criar(receita.make)
    },
    [criar],
  )

  /** Menu abre à direita da saída. Coordenadas do fluxo: o portal segue pan/zoom. */
  const ancora = useMemo(() => {
    if (!criandoEm) return null
    const node = graph.nodes.find(current => current.id === criandoEm.nodeId)
    if (!node?.position) return null

    const portas = nodePorts(node)
    const indice = Math.max(
      0,
      portas.findIndex(port => port.id === criandoEm.portId),
    )

    // Mesma conta do `topo` em `flow-block`: bolinhas centradas na altura do cartão.
    const altura = Math.max(NODE_HEIGHT, 40 + portas.length * PORT_ROW)
    const offset =
      altura / 2 - ((portas.length - 1) * PORT_ROW) / 2 + indice * PORT_ROW

    return {
      x: node.position.x + NODE_WIDTH + 48,
      y: node.position.y + offset - 16,
    }
  }, [criandoEm, graph.nodes])

  /** Onde o cartão de edição abre: à direita do bloco selecionado. */
  const ancoraEdicao = useMemo(() => {
    if (!selecionado) return null
    const node = graph.nodes.find(current => current.id === selecionado)
    if (!node?.position) return null

    return { x: node.position.x + NODE_WIDTH + 48, y: node.position.y }
  }, [selecionado, graph.nodes])

  /** Grafo → canvas. No arrasto a posição do canvas manda; o resto continua entrando. */
  useEffect(() => {
    setNodes(atuais => {
      const porId = new Map(atuais.map(node => [node.id, node]))
      // Número segue o percurso da conversa, não a ordem de criação dos blocos.
      const ordens = readingOrder(graph)

      return graph.nodes.map(node => {
        const atual = porId.get(node.id)
        const position =
          arrastando.current && atual
            ? atual.position
            : (node.position ?? atual?.position ?? { x: 0, y: 0 })

        return {
          id: node.id,
          type: 'flowBlock',
          position,
          selected: node.id === selecionado,
          dragging: atual?.dragging ?? false,
          deletable: false,
          data: dados(node, ordens.get(node.id) ?? 0) satisfies FlowBlockData,
        }
      })
    })
  }, [graph, dados, selecionado])

  // A seleção da aresta vive só no React Flow: clicar emite um `select` por
  // `onEdgesChange`, e sem reaplicá-lo aqui o Delete não acha nada para apagar.
  const [edges, setEdges] = useState<Edge[]>([])

  /** Muda só quando o desenho das arestas muda de verdade — ver `edgesKey`. */
  const chave = edgesKey(graph)

  useEffect(() => {
    const { graph: atualGraph } = atual.current

    setEdges(atuais => {
      const selecionadas = new Set(
        atuais.filter(edge => edge.selected).map(edge => edge.id),
      )

      const porOrigem = new Map(atualGraph.nodes.map(node => [node.id, node]))

      return canvasEdges(atualGraph).map(edge => {
        const origem = porOrigem.get(edge.source)
        const port = parsePortId(edge.sourceHandle)
        const renomeavel = origem && port && isPortRenameable(origem, port)

        return {
          id: edge.id,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle,
          type: 'editable',
          deletable: true,
          // Reconstruir a lista não pode desfazer a seleção do que continua existindo.
          selected: selecionadas.has(edge.id),
          // Seta na ponta: sem ela, laço voltando a um passo anterior fica ambíguo.
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          // Fiação do rótulo mantida: o desenho está comentado em `editable-edge`.
          data: {
            texto: edge.label,
            onRename: renomeavel
              ? (texto: string) => {
                  const { graph: grafo, onChange: aplicar } = atual.current
                  aplicar({
                    ...grafo,
                    nodes: grafo.nodes.map(node =>
                      node.id === edge.source
                        ? setPortLabel(node, port, texto)
                        : node,
                    ),
                  })
                }
              : undefined,
          } satisfies EditableEdgeData,
        }
      })
    })
  }, [chave])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Posição volta para o grafo no stop; a seleção sobe pelo onNodeClick/onPaneClick.
    setNodes(atuais => applyNodeChanges(changes, atuais))
  }, [])

  const onNodeDragStart = useCallback(() => {
    arrastando.current = true
  }, [])

  /** Editar um bloco fecha o menu de tipos: os dois abrem no mesmo lugar. */
  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      setCriandoEm(null)
      onSelecionar(node.id)
    },
    [onSelecionar],
  )

  /** Clicar na ligação tira o bloco de foco: senão o painel ficava aberto sem dono. */
  const onEdgeClick = useCallback(() => {
    setCriandoEm(null)
    onSelecionar(null)
  }, [onSelecionar])

  const onPaneClick = useCallback(() => {
    setCriandoEm(null)
    onSelecionar(null)
  }, [onSelecionar])

  const onNodeDragStop = useCallback(() => {
    arrastando.current = false

    const posicoes = new Map(nodes.map(node => [node.id, node.position]))
    const mudou = graph.nodes.some(node => {
      const nova = posicoes.get(node.id)
      return (
        nova && (nova.x !== node.position?.x || nova.y !== node.position?.y)
      )
    })
    if (!mudou) return

    onChange({
      ...graph,
      nodes: graph.nodes.map(node => {
        const position = posicoes.get(node.id)
        return position ? { ...node, position } : node
      }),
    })
  }, [nodes, graph, onChange])

  /** Aponta uma porta de `source` para `target`. */
  const religar = useCallback(
    (source: string, handle: string | null | undefined, target: string) => {
      const port = parsePortId(handle)
      if (!port) return

      onChange({
        ...graph,
        nodes: graph.nodes.map(node =>
          node.id === source ? setPortTarget(node, port, target) : node,
        ),
      })
    },
    [graph, onChange],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      religar(connection.source, connection.sourceHandle, connection.target)
    },
    [religar],
  )

  /** A porta de origem é campo do nó; o arrasto move só o destino. */
  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      religou.current = true
      if (!connection.target) return
      religar(oldEdge.source, oldEdge.sourceHandle, connection.target)
    },
    [religar],
  )

  // A lib tira a aresta da tela ao pegar a ponta e só devolve se `onReconnect` disparar.
  // Sem este par, errar o alvo deixava a linha sumida.
  const onReconnectStart = useCallback(() => {
    religou.current = false
  }, [])

  const onReconnectEnd = useCallback(() => {
    if (!religou.current) onChange({ ...graph })
  }, [graph, onChange])

  // Aplicar todas as mudanças é o que faz o Delete funcionar: filtrar só `remove`
  // descartava o `select` que marca a aresta.
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(atuais => applyEdgeChanges(changes, atuais))

      const removidas = changes.filter(change => change.type === 'remove')
      if (removidas.length === 0) return

      let next = graph
      for (const change of removidas) {
        const [source, ...resto] = change.id.split(':')
        const port = parsePortId(resto.join(':'))
        if (!source || !port) continue

        next = {
          ...next,
          nodes: next.nodes.map(node =>
            node.id === source ? clearPort(node, port) : node,
          ),
        }
      }
      onChange(next)
    },
    [graph, onChange],
  )

  return (
    <div className="thinkbot-canvas h-[calc(100vh-13rem)] min-h-105 w-full overflow-hidden rounded-xl border border-border bg-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        fitView
        /* Delete só atinge ligação: os nós vão com `deletable: false`, senão apagar
           uma ligação selecionada levaria junto o bloco em foco. */
        deleteKeyCode={['Delete', 'Backspace']}
        nodesConnectable
        edgesReconnectable
        elementsSelectable
        /* Área de pega da ponta da ligação: 10px é difícil de acertar no trackpad. */
        reconnectRadius={16}
        minZoom={0.1}
        maxZoom={1.5}
        onlyRenderVisibleElements
      >
        {ancoraEdicao && editor ? (
          <ViewportPortal>
            <div
              style={{
                position: 'absolute',
                transform: `translate(${ancoraEdicao.x}px, ${ancoraEdicao.y}px)`,
                zIndex: 9,
              }}
              /* `pointer-events-auto` obrigatório: `.react-flow__viewport` vem da lib
                 com `pointer-events: none` e só os nós têm regra que reativa. */
              className="nodrag nowheel nopan pointer-events-auto w-80"
            >
              {editor}
            </div>
          </ViewportPortal>
        ) : null}

        {ancora ? (
          <ViewportPortal>
            <div
              style={{
                position: 'absolute',
                transform: `translate(${ancora.x}px, ${ancora.y}px)`,
                zIndex: 10,
              }}
              /* Mesmo motivo do painel: o viewport não passa o mouse adiante. */
              className="pointer-events-auto"
            >
              <KindMenu
                onEscolher={criar}
                onEscolherReceita={criarReceita}
                onFechar={() => setCriandoEm(null)}
              />
            </div>
          </ViewportPortal>
        ) : null}

        {/* Ponto um tom acima do fundo: sobre o cinza, `size={1}` no padrão desaparece. */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.4}
          color="oklch(0.556 0.02 165 / 0.35)"
          bgColor="var(--canvas)"
        />
        <Controls
          showInteractive={false}
          className="border border-border bg-card shadow-sm"
        />

        {/* Legenda dentro do canvas: barra própria comia altura de desenho. */}
        <Panel
          position="top-center"
          className="m-2 rounded-lg border border-border/60 bg-card/85 px-2.5 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm"
        >
          Clique no + para adicionar o próximo passo · clique no bloco para
          editar · clique na linha e Delete apaga
        </Panel>
        {/* Recolhido por padrão: aberto, cobre o canto onde os blocos finais caem. */}
        {mapaAberto ? (
          <MiniMap
            pannable
            zoomable
            className="bottom-20! right-2! m-0! h-24! w-40! border! border-border! bg-card! sm:h-32! sm:w-52!"
            maskColor="oklch(0.97 0.006 165 / 0.7)"
            nodeColor="var(--primary)"
            nodeStrokeWidth={0}
          />
        ) : null}

        {/* Acima da marca do React Flow, que também mora no canto. */}
        <Panel position="bottom-right" className="mx-2! mb-10!">
          <button
            type="button"
            onClick={() => setMapaAberto(aberto => !aberto)}
            aria-pressed={mapaAberto}
            aria-label={mapaAberto ? 'Ocultar mapa' : 'Mostrar mapa'}
            title={mapaAberto ? 'Ocultar mapa' : 'Mostrar mapa'}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {mapaAberto ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <MapIcon className="h-3.5 w-3.5" />
            )}
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
