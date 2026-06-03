import { useEffect, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { SpreadsheetHeader } from '../../../types'

export function useSheetHeader(
  open: boolean,
  spreadsheetId: string,
  tabTitle: string,
) {
  const [header, setHeader] = useState<SpreadsheetHeader | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    const id = encodeURIComponent(spreadsheetId)
    const tabParam = encodeURIComponent(tabTitle)
    axiosImportsheet()
      .get(`/importsheet/sheets/${id}/header?tab=${tabParam}`)
      .then(res => {
        if (!active) return
        const data = res as unknown as { header: SpreadsheetHeader }
        setHeader(data.header)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Falha ao ler o cabeçalho.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, spreadsheetId, tabTitle])

  return { header, loading, error }
}
