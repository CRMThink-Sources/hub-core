'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  productUpdateErrorKey,
  readProductUpdateError,
  type ProductUpdateError,
} from '@/lib/portal-product-updates'

const NAMESPACE = 'admin/product-updates'

/** Texto de um erro de novidade no idioma do portal, com os detalhes da api. */
export function useProductUpdateErrorText() {
  const { t } = useTranslation(NAMESPACE)

  return useCallback(
    (info: ProductUpdateError): { message: string; detail?: string } => {
      const message = t(productUpdateErrorKey(info), {
        locales: info.missingLocales
          .map(locale => t(`locales.${locale}`))
          .join(', '),
        taskId: info.taskId,
        issues: info.issues.join('; '),
      })
      // O Bitrix explica a falha (permissão, fora do ar): vale mostrar como veio.
      const detail =
        info.reason === 'crmthink-tasks-unavailable' ? info.message : undefined
      return { message, detail }
    },
    [t],
  )
}

/**
 * Toast de erro de uma ação. "Tarefa já vinculada" ganha o atalho para a novidade
 * que usa a tarefa, quando a api a informa.
 */
export function useProductUpdateErrorToast() {
  const { t } = useTranslation(NAMESPACE)
  const router = useRouter()
  const text = useProductUpdateErrorText()

  return useCallback(
    (error: unknown): ProductUpdateError => {
      const info = readProductUpdateError(error)
      const { message, detail } = text(info)
      const owner =
        info.reason === 'task-already-linked' ? info.productUpdateId : null

      toast.error(message, {
        description: detail,
        action: owner
          ? {
              label: t('errors.task-already-linked-open'),
              onClick: () =>
                router.push(`/admin/novidades/${encodeURIComponent(owner)}`),
            }
          : undefined,
      })
      return info
    },
    [router, t, text],
  )
}
