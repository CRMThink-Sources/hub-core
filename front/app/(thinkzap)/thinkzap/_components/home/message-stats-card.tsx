import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MessageDirectionCounts } from '../../_lib/get-thinkzap-home-message-stats'
import { percentChange } from '../../_lib/message-stats-math'
import { TrendBadge } from './trend-badge'

type Props = {
  title: string
  icon: LucideIcon
  counts: MessageDirectionCounts
  previous: MessageDirectionCounts
  activeLines: number
}

const numberFormatter = new Intl.NumberFormat('pt-BR')

export function MessageStatsCard({
  title,
  icon: Icon,
  counts,
  previous,
  activeLines,
}: Props) {
  return (
    <div className="min-w-[240px] flex-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <Link
          href="/thinkzap/conexoes"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          {activeLines} {activeLines === 1 ? 'linha ativa' : 'linhas ativas'}
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">Enviadas</dt>
          <div className="mt-0.5 flex items-baseline gap-2">
            <dd className="text-2xl font-semibold">
              {numberFormatter.format(counts.sent)}
            </dd>
            <TrendBadge trend={percentChange(counts.sent, previous.sent)} />
          </div>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Recebidas</dt>
          <div className="mt-0.5 flex items-baseline gap-2">
            <dd className="text-2xl font-semibold">
              {numberFormatter.format(counts.received)}
            </dd>
            <TrendBadge
              trend={percentChange(counts.received, previous.received)}
            />
          </div>
        </div>
      </dl>
    </div>
  )
}
