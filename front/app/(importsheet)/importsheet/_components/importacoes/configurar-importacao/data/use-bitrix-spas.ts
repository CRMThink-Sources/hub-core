import { useEffect, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { BitrixEntity } from '../../../types'

export function useBitrixSpas(open: boolean) {
  const [spas, setSpas] = useState<BitrixEntity[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    axiosImportsheet()
      .get('/importsheet/bitrix/entities')
      .then(res => {
        if (!active) return
        const data = res as unknown as { entities: BitrixEntity[] }
        setSpas(data.entities.filter(e => e.isSpa))
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Falha ao carregar SPAs.')
      })
    return () => {
      active = false
    }
  }, [open])

  return { spas, error }
}
