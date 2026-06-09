import { useEffect, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { BitrixField } from '../../../types'

export function useBitrixFields(
  open: boolean,
  isTask: boolean,
  resolvedEntityTypeId: number | null,
) {
  const [fields, setFields] = useState<BitrixField[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const query = isTask
      ? 'entityCode=TASK'
      : resolvedEntityTypeId !== null
        ? `entityTypeId=${resolvedEntityTypeId}`
        : null
    if (query === null) {
      setFields(null)
      return
    }
    let active = true
    setLoading(true)
    axiosImportsheet()
      .get(`/importsheet/bitrix/fields?${query}`)
      .then(res => {
        if (!active) return
        const data = res as unknown as { fields: BitrixField[] }
        setFields(data.fields)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Falha ao carregar campos.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, isTask, resolvedEntityTypeId])

  return { fields, loading, error }
}
