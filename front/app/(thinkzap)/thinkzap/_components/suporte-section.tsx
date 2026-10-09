'use client'

import { Clock, Hourglass } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

export function SuporteSection() {
  const { t } = useTranslation('thinkzap/ajuda/page')

  return (
    <section id="suporte" className="flex w-full flex-col gap-6">
      <div className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t('suporte.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t('suporte.horario')}
            </span>{' '}
            {t('suporte.fuso')}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
        <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-foreground">
          <Trans t={t} components={{ b: <span className="font-semibold" /> }}>
            {t('suporte.tempoEspera')}
          </Trans>
        </p>
      </div>
    </section>
  )
}
