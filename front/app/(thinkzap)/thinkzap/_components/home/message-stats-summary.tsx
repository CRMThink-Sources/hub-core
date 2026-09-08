import { Inbox, Send } from 'lucide-react'
import type { MessageDirectionCounts } from '../../_lib/get-thinkzap-home-message-stats'
import { percentChange } from '../../_lib/message-stats-math'
import { TrendBadge } from './trend-badge'

type Props = {
  current: MessageDirectionCounts
  previous: MessageDirectionCounts
}

const numberFormatter = new Intl.NumberFormat('pt-BR')

/** Soma dos providers (web + oficial), em destaque acima dos cards por provider. */
export function MessageStatsSummary({ current, previous }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
      <div className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Send className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total enviadas</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="text-3xl font-semibold">
              {numberFormatter.format(current.sent)}
            </p>
            <TrendBadge trend={percentChange(current.sent, previous.sent)} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Inbox className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total recebidas</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="text-3xl font-semibold">
              {numberFormatter.format(current.received)}
            </p>
            <TrendBadge
              trend={percentChange(current.received, previous.received)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
