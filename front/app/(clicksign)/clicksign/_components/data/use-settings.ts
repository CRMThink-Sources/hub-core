'use client'

import { useCallback, useEffect, useState } from 'react'
import { axiosClicksign } from '@/infra/client/axios-clicksign'

export type ClicksignSettings = {
  fields: unknown
  verifySettings: unknown
  contactSettings: unknown
  dealSettings: unknown
  groups: unknown
}

type GetResponse = { settings: ClicksignSettings }

export function useSettings() {
  const [settings, setSettings] = useState<ClicksignSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(
      axiosClicksign().get(
        '/clicksign/settings',
      ) as unknown as Promise<GetResponse>
    )
      .then(res => {
        if (active) setSettings(res.settings ?? null)
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Falha ao carregar')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const save = useCallback(async (patch: Partial<ClicksignSettings>) => {
    const res = (await axiosClicksign().patch(
      '/clicksign/settings',
      patch,
    )) as unknown as GetResponse
    setSettings(res.settings ?? null)
    return res.settings
  }, [])

  return { settings, loading, error, save }
}
