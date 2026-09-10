'use client'

import { useState } from 'react'
import { Link2, Loader2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OpenChannel } from '../../_lib/bot-flow-client'
import type { BotFlowBinding, BotFlowSummary } from '@/shared/thinkzap-bot-flow'

/** O nome vem da nossa API já resolvido; id cru é a reserva honesta. */
function nomeCanal(canal: OpenChannel): string {
  return canal.name?.trim() || `Canal #${canal.id}`
}

const select =
  'rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

type Props = {
  flow: BotFlowSummary
  /** Vínculo deste fluxo, se houver. */
  binding: BotFlowBinding | null
  /** Canais do portal. `null` = ainda carregando. */
  linhas: OpenChannel[] | null
  /** Mensagem quando a listagem falhou. Vazio por erro != portal sem canais. */
  linhasErro: string | null
  /** Canais já usados por outro fluxo: um canal aceita um fluxo só. */
  ocupadas: Map<string, string>
  onVincular: (lineId: string) => Promise<void>
  onDesvincular: (bindingId: string) => Promise<void>
}

// Publicar valida o desenho; vincular é o que põe o fluxo no ar. Sem esta coluna o
// fluxo ficava publicado e inerte sem explicação na tela.
export function CanalCell({
  flow,
  binding,
  linhas,
  linhasErro,
  ocupadas,
  onVincular,
  onDesvincular,
}: Props) {
  const [escolhido, setEscolhido] = useState('')
  const [salvando, setSalvando] = useState(false)

  if (flow.status !== 'PUBLISHED') {
    return (
      <span className="text-xs text-muted-foreground">
        publique para vincular
      </span>
    )
  }

  if (binding) {
    const linha = linhas?.find(item => String(item.id) === binding.lineId)

    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
          <Link2 className="h-3 w-3 text-primary" />
          {linha ? nomeCanal(linha) : `Canal #${binding.lineId}`}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Remover vínculo"
          aria-label="Remover vínculo"
          disabled={salvando}
          onClick={() => {
            setSalvando(true)
            void onDesvincular(binding.id).finally(() => setSalvando(false))
          }}
        >
          {salvando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlink className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>
    )
  }

  if (!linhas) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        canais
      </span>
    )
  }

  /** Canal já usado por outro fluxo não entra: a API recusaria com 400. */
  const livres = linhas.filter(item => !ocupadas.has(String(item.id)))

  if (livres.length === 0) {
    // Três motivos para não haver opção, com ação diferente em cada um: erro de
    // listagem, portal sem canais e todos já vinculados.
    if (linhasErro) {
      return (
        <span
          className="text-xs text-destructive"
          title={`Erro do Bitrix: ${linhasErro}`}
        >
          não foi possível listar os canais
        </span>
      )
    }

    return (
      <span className="text-xs text-muted-foreground">
        {linhas.length === 0
          ? 'nenhum canal aberto no portal'
          : 'todos os canais já têm fluxo'}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={escolhido}
        disabled={salvando}
        onChange={event => setEscolhido(event.target.value)}
        className={`${select} max-w-40 cursor-pointer`}
      >
        <option value="">escolher canal…</option>
        {livres.map(item => (
          <option key={String(item.id)} value={String(item.id)}>
            {nomeCanal(item)}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={!escolhido || salvando}
        onClick={() => {
          setSalvando(true)
          void onVincular(escolhido).finally(() => setSalvando(false))
        }}
      >
        {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'ativar'}
      </Button>
    </div>
  )
}
