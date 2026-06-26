'use client'

import { useEffect, useState } from 'react'
import { axiosClicksign } from '@/infra/client/axios-clicksign'
import type { Option } from '../types'
import type { ClickSignField } from './types'

export function useContactFields() {
  const [fields, setFields] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(
      axiosClicksign().get(
        '/clicksign/bitrix/fields?entity=contact',
      ) as unknown as Promise<{ fields: ClickSignField[] }>
    )
      .then(res => {
        if (!active) return
        setFields((res.fields ?? []).map(f => ({ code: f.code, name: f.name })))
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Falha ao carregar campos')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { fields, loading, error }
}
