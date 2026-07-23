'use client'

import { AlertTriangle, Download, ShieldCheck } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'

type Diretriz = {
  titulo: string
  pontos: string[]
}

export default function DiretrizesPage() {
  const { t } = useTranslation('thinkzap/diretrizes/page')

  const diretrizes = t('diretrizes', { returnObjects: true }) as Diretriz[]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      {/* Cabeçalho */}
      <div className="flex w-full gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
        <p className="text-sm text-foreground">
          <Trans t={t} components={{ b: <span className="font-semibold" /> }}>
            {t('disclaimer')}
          </Trans>
        </p>
      </div>

      {/* Cards de diretrizes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {diretrizes.map(diretriz => (
          <section
            key={diretriz.titulo}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
          >
            <h2 className="text-lg font-semibold text-primary">
              {diretriz.titulo}
            </h2>
            <ul className="flex flex-col gap-2">
              {diretriz.pontos.map((ponto, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>
                    <Trans
                      t={t}
                      components={{
                        b: <span className="font-semibold text-foreground" />,
                      }}
                    >
                      {ponto}
                    </Trans>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Rodapé: download do PDF */}
      <div className="flex justify-center border-t border-border pt-6">
        <a
          href="/documents/thinkzap-diretrizes.pdf"
          download
          className={buttonVariants({ variant: 'outline' })}
        >
          <Download className="h-4 w-4" />
          {t('baixarPdf')}
        </a>
      </div>
    </div>
  )
}
