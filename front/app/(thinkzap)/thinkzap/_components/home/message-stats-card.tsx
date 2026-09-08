import type { MessageDirectionCounts } from '../../_lib/get-thinkzap-home-message-stats'

type Props = {
  title: string
  counts: MessageDirectionCounts
}

const numberFormatter = new Intl.NumberFormat('pt-BR')

export function MessageStatsCard({ title, counts }: Props) {
  return (
    <div className="flex-1 min-w-[220px] rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">Enviadas</dt>
          <dd className="text-2xl font-semibold">
            {numberFormatter.format(counts.sent)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Recebidas</dt>
          <dd className="text-2xl font-semibold">
            {numberFormatter.format(counts.received)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
