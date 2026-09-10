'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { FlowNodeKind } from '@/shared/thinkzap-bot-flow'
import { KIND_ICON, KIND_ICON_COLOR } from './kind-visual'
import {
  NODE_KIND_GROUPS,
  NODE_KIND_HINT,
  NODE_KIND_LABEL,
  NODE_RECIPES,
} from '@/shared/thinkzap-bot-flow'

/**
 * Menu de tipos, aberto pelo `+` de uma saída.
 *
 * Escolher aqui cria o bloco **já ligado** àquela saída. É o que substitui a barra
 * "Adicionar bloco": criar solto e arrastar a ligação depois era o passo que travava.
 *
 * **Grade de dois, sem texto de dica.** Uma linha por tipo com descrição embaixo dava
 * uma lista de rolagem de ~400px para seis tipos; em chips de duas colunas o menu todo
 * cabe sem rolar, e o nome do tipo já diz o que ele faz.
 */
export function KindMenu({
  onEscolher,
  onEscolherReceita,
  onFechar,
}: {
  onEscolher: (kind: FlowNodeKind) => void
  /** Receita pronta: o mesmo tipo de nó, já preenchido. */
  onEscolherReceita?: (recipeId: string) => void
  onFechar: () => void
}) {
  useEffect(() => {
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  return (
    <div className="nodrag nowheel nopan w-59 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <span className="flex-1 text-[12px] font-semibold text-foreground">
          Qual a interação que deseja?
        </span>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onFechar}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-2 pb-2.5">
        {NODE_KIND_GROUPS.map(grupo => (
          <div key={grupo.titulo}>
            <p className="px-1 pb-1.5 pt-2 text-[10px] font-medium text-primary">
              {grupo.titulo}
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {grupo.kinds.map(kind => {
                const Icon = KIND_ICON[kind]

                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onEscolher(kind)}
                    /* A dica virou `title`: no chip ela não cabe, mas continua ao alcance. */
                    title={NODE_KIND_HINT[kind]}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/70 px-2 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${KIND_ICON_COLOR[kind]}`}
                    />
                    <span className="min-w-0 truncate text-[11px] text-foreground">
                      {NODE_KIND_LABEL[kind]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {onEscolherReceita ? (
          <div>
            <p className="px-1 pb-1.5 pt-2 text-[10px] font-medium text-primary">
              Prontos
            </p>

            {/* Uma coluna: o rótulo é uma frase e não caberia no chip de meia largura. */}
            <div className="flex flex-col gap-1.5">
              {NODE_RECIPES.map(receita => {
                const Icon = KIND_ICON[receita.kind]

                return (
                  <button
                    key={receita.id}
                    type="button"
                    onClick={() => onEscolherReceita(receita.id)}
                    title={receita.hint}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/70 px-2 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${KIND_ICON_COLOR[receita.kind]}`}
                    />
                    <span className="min-w-0 truncate text-[11px] text-foreground">
                      {receita.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
