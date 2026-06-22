import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { BitrixCategory } from '../../../types'

export function useBitrixCategories(
  open: boolean,
  needsPipeline: boolean,
  entityTypeId: number | null,
) {
  const { t } = useTranslation('importsheet/configurar-importacao')
  const [categories, setCategories] = useState<BitrixCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !needsPipeline || entityTypeId === null) {
      setCategories([])
      return
    }
    let active = true
    setLoading(true)
    axiosImportsheet()
      .get(`/importsheet/bitrix/categories?entityTypeId=${entityTypeId}`)
      .then(res => {
        if (!active) return
        const data = res as unknown as { categories: BitrixCategory[] }
        setCategories(data.categories)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : t('erros.pipelines'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, needsPipeline, entityTypeId, t])

  return { categories, loading, error }
}
