'use client'

import { useTranslation } from 'react-i18next'
import { channelSlaVsMeta } from '@/lib/insights-full'
import { formatDuration } from '@/lib/insights-format'
import { Panel, Pill } from './ui-bits'

/**
 * Objetivo de 1ª resposta configurado em cada canal, ao lado da referência do
 * painel. A referência é a escolhida no painel (cartão Rapidez e gráficos);
 * o canal não a altera, só serve de comparação.
 */
export function ChannelSlaPanel({
  channelSla,
  refMin,
}: {
  channelSla: { name: string; seconds: number }[] | null
  refMin: number
}) {
  const { t } = useTranslation('thinkzap/insights')
  const rows = channelSlaVsMeta(channelSla, refMin)

  return (
    <Panel title={t('full.channelSla.title')}>
      <p className="mb-2 text-sm text-foreground/80">
        {t('full.channelSla.hint', { value: formatDuration(refMin * 60) })}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('full.channelSla.empty')}
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map(row => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate" title={row.name}>
                {row.name}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                {formatDuration(row.seconds)}
                <Pill tone={row.versus === 'same' ? 'mute' : 'warn'}>
                  {t(`full.channelSla.versus.${row.versus}`)}
                </Pill>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
