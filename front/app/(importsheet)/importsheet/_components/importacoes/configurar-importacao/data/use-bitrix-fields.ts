import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { BitrixField } from '../../../types'

export function useBitrixFields(
  open: boolean,
  isTask: boolean,
  resolvedEntityTypeId: number | null,
) {
  const { t } = useTranslation('importsheet/configurar-importacao')
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
        setError(e instanceof Error ? e.message : t('erros.campos'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, isTask, resolvedEntityTypeId, t])

  return { fields, loading, error }
}
