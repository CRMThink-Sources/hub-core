'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createProductUpdate,
  readProductUpdateError,
} from '@/lib/portal-product-updates'
import { useProductUpdateErrorText } from './admin-product-update-errors'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPageHeader } from './ui/admin-page-header'

const NAMESPACE = 'admin/product-updates'

/**
 * `/admin/novidades/nova`: cria o rascunho vazio e troca a rota pela edição dele
 * (`replace`, para o "voltar" não criar outro). A imagem e a tarefa precisam do id,
 * por isso o rascunho nasce antes do primeiro "Salvar".
 */
export function AdminProductUpdateCreatePage() {
  const { t } = useTranslation(NAMESPACE)
  const router = useRouter()
  const errorText = useProductUpdateErrorText()
  const [error, setError] = useState<string | null>(null)
  /** O efeito roda duas vezes no StrictMode: um rascunho só. */
  const started = useRef(false)

  const create = useCallback(async () => {
    setError(null)
    try {
      const created = await createProductUpdate()
      router.replace(`/admin/novidades/${encodeURIComponent(created.id)}`)
    } catch (caught) {
      setError(errorText(readProductUpdateError(caught)).message)
    }
  }, [errorText, router])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void create()
  }, [create])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: t('detail.breadcrumb'), href: '/admin/novidades' },
          { label: t('new') },
        ]}
        title={t('new')}
      />

      {error ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('create.errorTitle')}
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void create()}>
              <RotateCw aria-hidden className="size-3.5" />
              {t('retry')}
            </Button>
          }
        />
      ) : (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          {t('create.pending')}
        </p>
      )}
    </div>
  )
}
