'use client'

import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export type EditableEdgeData = {
  texto: string
  /** Ausente = rótulo fixo ("não entendeu", "senão"), que não vem de campo editável. */
  onRename?: (texto: string) => void
}

// `interactionWidth`: 1.5px é fino demais para clicar e selecionar antes do Delete.
//
// Sem rótulo na linha: com blocos próximos, pills de arestas vizinhas se cruzavam e
// nenhum ficava legível. Renomear segue no painel do bloco, que grava no mesmo campo.
export function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
}: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  })

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      interactionWidth={20}
      style={{
        strokeWidth: selected ? 2.5 : 1.75,
        stroke: selected ? 'var(--primary)' : 'oklch(0.55 0.02 165 / 0.55)',
      }}
    />
  )
}

/*
  Rótulo editável na linha, guardado. Para voltar: restaurar os imports (`useEffect`,
  `useRef`, `useState`, `EdgeLabelRenderer`), pegar `data` das props, tomar
  `labelX`/`labelY` do `getSmoothStepPath` e renderizar isto depois do `BaseEdge`.

  const { texto, onRename } = (data ?? {}) as EditableEdgeData
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(texto ?? '')
  const input = useRef<HTMLInputElement | null>(null)
  // Rótulo editável mas ainda sem nome: o pill é convite, não conteúdo.
  const vazio = !texto && !!onRename

  useEffect(() => {
    if (!editando) setValor(texto ?? '')
  }, [texto, editando])

  useEffect(() => {
    if (editando) input.current?.select()
  }, [editando])

  function confirmar() {
    setEditando(false)
    if (onRename && valor !== texto) onRename(valor)
  }

  {texto || onRename ? (
    <EdgeLabelRenderer>
      <div
        style={{
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        }}
        className="nodrag nopan pointer-events-auto absolute"
      >
        {editando ? (
          <input
            ref={input}
            value={valor}
            autoFocus
            onChange={event => setValor(event.target.value)}
            onBlur={confirmar}
            onKeyDown={event => {
              if (event.key === 'Enter') confirmar()
              if (event.key === 'Escape') {
                setValor(texto ?? '')
                setEditando(false)
              }
              // Delete/Backspace aqui é edição de texto, não remoção da ligação.
              event.stopPropagation()
            }}
            className="w-28 rounded border border-primary bg-background px-1 py-0.5 text-center text-[10px] outline-none"
          />
        ) : (
          <button
            type="button"
            // Rótulo fixo não abre edição: não há campo por trás dele.
            onDoubleClick={onRename ? () => setEditando(true) : undefined}
            title={onRename ? 'Duplo clique para renomear' : undefined}
            className={`max-w-35 truncate rounded-full border px-1.5 py-px text-[9px] font-medium shadow-sm ${
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground'
            } ${
              onRename ? 'cursor-text hover:border-primary/60' : 'cursor-default'
            } ${
              // Convite a nomear se revela no hover. Não usar `opacity-0`: o pill é o
              // próprio alvo do mouse, e invisível por opacidade ele continua capturando
              // o clique sem dar sinal de que está ali. Transparente por cor mantém o
              // alvo com o mesmo tamanho e sem chamar atenção.
              vazio
                ? 'border-transparent! bg-transparent! text-transparent! hover:border-border! hover:bg-card! hover:text-muted-foreground!'
                : ''
            }`}
          >
            {texto || (onRename ? 'sem rótulo' : '')}
          </button>
        )}
      </div>
    </EdgeLabelRenderer>
  ) : null}
*/
