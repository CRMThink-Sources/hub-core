'use client'

import { useMemo, useState } from 'react'
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OpenChannel } from '../../_lib/bot-flow-client'
import type { BotFlowBinding, BotFlowSummary } from '@/shared/thinkzap-bot-flow'
import { CanalCell } from './canal-cell'

type Props = {
  flows: BotFlowSummary[]
  bindings: BotFlowBinding[]
  linhas: OpenChannel[] | null
  /** Mensagem quando a listagem falhou — distinto de portal sem canais. */
  linhasErro: string | null
  onOpen: (flowId: string) => void
  onDelete: (flowId: string) => Promise<void>
  onCreate: () => void
  onVincular: (flowId: string, lineId: string) => Promise<void>
  onDesvincular: (bindingId: string) => Promise<void>
}

const STATUS_STYLE: Record<BotFlowSummary['status'], string> = {
  PUBLISHED: 'bg-primary/10 text-primary',
  DRAFT: 'bg-amber-500/10 text-amber-700',
  ARCHIVED: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<BotFlowSummary['status'], string> = {
  PUBLISHED: 'Publicada',
  DRAFT: 'Rascunho',
  ARCHIVED: 'Arquivada',
}

export function BotFlowList({
  flows,
  bindings,
  linhas,
  linhasErro,
  onOpen,
  onDelete,
  onCreate,
  onVincular,
  onDesvincular,
}: Props) {
  const [excluindo, setExcluindo] = useState<string | null>(null)

  /** Índices por fluxo e por canal: `find` por linha da tabela seria O(n²). */
  const porFlow = useMemo(
    () => new Map(bindings.map(binding => [binding.flowId, binding])),
    [bindings],
  )

  /** Canal → nome do fluxo que o ocupa, para o seletor não oferecer o que a API recusa. */
  const ocupadas = useMemo(() => {
    const nomes = new Map(flows.map(flow => [flow.id, flow.name]))
    return new Map(
      bindings.map(binding => [
        binding.lineId,
        nomes.get(binding.flowId) ?? 'outro fluxo',
      ]),
    )
  }, [bindings, flows])

  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
          <Bot className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Nenhum fluxo criado
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Um fluxo é o fluxo que o bot segue: blocos ligados definindo o que
            ele fala, o que pergunta e quando chama um atendente.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Criar primeiro fluxo
        </Button>
      </div>
    )
  }

  // Publicado e sem canal não atende ninguém. O aviso fica aqui porque é aqui que se
  // resolve: a coluna ao lado tem o seletor.
  const inertes = flows.filter(
    flow => flow.status === 'PUBLISHED' && !porFlow.has(flow.id),
  )

  return (
    <div className="flex flex-col gap-3">
      {inertes.length > 0 ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {inertes.length === 1
            ? `"${inertes[0]?.name}" está publicada mas ainda não atende ninguém — escolha um canal aberto em "Atende em".`
            : `${inertes.length} fluxos publicados ainda não atendem ninguém — escolha um canal aberto em "Atende em".`}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Fluxo</th>
              <th className="px-4 py-3 font-semibold">Situação</th>
              <th className="px-4 py-3 font-semibold">Atende em</th>
              <th className="px-4 py-3 font-semibold">Passos</th>
              <th className="px-4 py-3 font-semibold">Versão</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {flows.map(flow => (
              <tr
                key={flow.id}
                className="border-b border-border last:border-0 hover:bg-muted/50"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(flow.id)}
                    className="cursor-pointer text-left font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {flow.name}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[flow.status]}`}
                  >
                    {STATUS_LABEL[flow.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <CanalCell
                    flow={flow}
                    binding={porFlow.get(flow.id) ?? null}
                    linhas={linhas}
                    linhasErro={linhasErro}
                    ocupadas={ocupadas}
                    onVincular={lineId => onVincular(flow.id, lineId)}
                    onDesvincular={onDesvincular}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {flow.nodeCount}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  v{flow.version}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onOpen(flow.id)}
                      aria-label="Editar fluxo"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={excluindo === flow.id}
                      onClick={() => {
                        setExcluindo(flow.id)
                        void onDelete(flow.id).finally(() => setExcluindo(null))
                      }}
                      aria-label="Excluir fluxo"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
