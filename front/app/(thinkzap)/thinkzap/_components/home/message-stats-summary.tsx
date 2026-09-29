'use client'

import { useTranslation } from 'react-i18next'
import { Inbox, Send } from 'lucide-react'
import type { MessageDirectionCounts } from '../../_lib/get-thinkzap-home-message-stats'
import { percentChange } from '../../_lib/message-stats-math'
import { useNumberFormatter } from '../../_lib/use-number-formatter'
import { TrendBadge } from './trend-badge'

type Props = {
  current: MessageDirectionCounts
  previous: MessageDirectionCounts
}

/** Soma dos providers (web + oficial), em destaque acima dos cards por provider. */
export function MessageStatsSummary({ current, previous }: Props) {
  const { t } = useTranslation('thinkzap/home')
  const numberFormatter = useNumberFormatter()

  return (
    <div className="grid grid-cols-1 gap-6 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
      <div className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Send className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t('stats.totalSent')}
          </p>
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
          <p className="text-xs text-muted-foreground">
            {t('stats.totalReceived')}
          </p>
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
