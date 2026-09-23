'use client'

import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'
import { DiretrizesSection } from '../_components/diretrizes-section'

/**
 * Ajuda: o manual (um card com o link para a documentação) e as diretrizes de uso,
 * numa página só. Eram dois itens no menu; o manual sozinho não sustentava uma
 * página, e sub-abas para um card seriam navegação sem conteúdo.
 */
export default function AjudaPage() {
  const { t } = useTranslation('thinkzap/ajuda/page')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full gap-6 rounded-xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href="https://crmthink.gitbook.io/thinkzap"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: 'lg' })}
            >
              {t('abrirManual')}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <DiretrizesSection />
    </div>
  )
}
