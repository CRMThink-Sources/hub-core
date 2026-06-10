'use client'

import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AjudaPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full gap-6 rounded-xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Ajuda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse o manual completo do ImportSheet
            </p>
          </div>

          <div className="shrink-0">
            <Button
              nativeButton={false}
              render={
                // preencher HREF quando tiver o Link para o manual do importSheet - Pendente Amanda
                <Link href="" target="_blank" rel="noopener noreferrer" />
              }
            >
              Abrir manual
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
