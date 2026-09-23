'use client'

import { useMemo, useState } from 'react'
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { OpenChannel } from '../../_lib/bot-flow-client'
import type { BotFlowBinding, BotFlowSummary } from '@/shared/thinkzap-bot-flow'
import { CanalCell } from './canal-cell'

type Props = {
  flows: BotFlowSummary[]
  bindings: BotFlowBinding[]
  linhas: OpenChannel[] | null
  /** Erro na listagem — distinto de portal sem canais. */
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
  const { t } = useTranslation('thinkzap/bots/lista')
  const [excluindo, setExcluindo] = useState<string | null>(null)

  // `find` por linha da tabela seria O(n²)
  const porFlow = useMemo(
    () => new Map(bindings.map(binding => [binding.flowId, binding])),
    [bindings],
  )

  // Canal → fluxo que o ocupa: seletor não oferece o que a API recusa
  const ocupadas = useMemo(() => {
    const nomes = new Map(flows.map(flow => [flow.id, flow.name]))
    return new Map(
      bindings.map(binding => [
        binding.lineId,
        nomes.get(binding.flowId) ?? t('outroFluxo'),
      ]),
    )
  }, [bindings, flows, t])

  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
          <Bot className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          {t('vazio.titulo')}
        </p>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" />
          {t('vazio.acao')}
        </Button>
      </div>
    )
  }

  // Publicado e sem canal não atende ninguém
  const inertes = flows.filter(
    flow => flow.status === 'PUBLISHED' && !porFlow.has(flow.id),
  )

  return (
    <div className="flex flex-col gap-3">
      {inertes.length > 0 ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {t('inertes', {
            count: inertes.length,
            nome: inertes[0]?.name ?? '',
          })}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-fixed text-left text-sm">
          {/* Larguras declaradas: com `auto` o navegador media cada coluna pelo conteúdo
              da linha, então a mesma coluna mudava de borda conforme o fluxo listado. */}
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[14%]" />
            <col />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted text-[11px] uppercase tracking-wide text-muted-foreground [&>th]:px-4 [&>th]:py-3 [&>th]:align-middle [&>th]:font-semibold">
              <th>{t('colunas.fluxo')}</th>
              <th>{t('colunas.situacao')}</th>
              <th>{t('colunas.atendeEm')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {flows.map(flow => (
              <tr
                key={flow.id}
                className="border-b border-border last:border-0 hover:bg-muted/50 [&>td]:px-4 [&>td]:py-3 [&>td]:align-middle"
              >
                <td>
                  <button
                    type="button"
                    onClick={() => onOpen(flow.id)}
                    className="cursor-pointer text-left font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {flow.name}
                  </button>
                </td>
                <td>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[flow.status]}`}
                  >
                    {t(`status.${flow.status}`)}
                  </span>
                </td>
                <td>
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
                <td>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onOpen(flow.id)}
                      aria-label={t('acoes.editar')}
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
                      aria-label={t('acoes.excluir')}
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
