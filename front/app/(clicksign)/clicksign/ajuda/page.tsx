'use client'

import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export default function AjudaPage() {
  const { t } = useTranslation('clicksign/ajuda')
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-10 sm:px-6 lg:px-8">
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
              {t('description')}
            </p>
          </div>

          <div className="shrink-0">
            <Button
              nativeButton={false}
              render={
                // TODO: preencher HREF do manual da Clicksign
                <Link href="" target="_blank" rel="noopener noreferrer" />
              }
            >
              {t('openManual')}
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
