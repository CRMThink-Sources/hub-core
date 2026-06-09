import { useEffect, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { BitrixCategory } from '../../../types'

export function useBitrixCategories(open: boolean, needsPipeline: boolean) {
  const [categories, setCategories] = useState<BitrixCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !needsPipeline) {
      setCategories([])
      return
    }
    let active = true
    setLoading(true)
    axiosImportsheet()
      .get('/importsheet/bitrix/categories?entityTypeId=2')
      .then(res => {
        if (!active) return
        const data = res as unknown as { categories: BitrixCategory[] }
        setCategories(data.categories)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(
          e instanceof Error ? e.message : 'Falha ao carregar pipelines.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, needsPipeline])

  return { categories, loading, error }
}
