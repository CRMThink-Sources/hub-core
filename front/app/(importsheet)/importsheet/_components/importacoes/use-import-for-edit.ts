'use client'

import { useEffect, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type {
  ImportDetail,
  ImportInitial,
  ImportSelection,
  SpreadsheetDetails,
} from '../types'

type EditData = { selection: ImportSelection; initial: ImportInitial }

function toInitial(detail: ImportDetail): ImportInitial {
  const { config } = detail
  return {
    importId: detail.id,
    title: detail.title,
    startRow: detail.startRow ?? 2,
    entityCode: config.target.entityCode,
    spaTypeId:
      config.target.entityCode === 'SPA' ? config.target.entityTypeId : null,
    categoryId: config.target.categoryId,
    responsible: config.responsible,
    options: config.options,
    scheduleManual: detail.scheduleMode === 'MANUAL',
    scheduleType: detail.scheduleMode === 'DAYS' ? 'days' : 'hours',
    everyHours: detail.everyHours ?? 1,
    weekdays: detail.weekdays ?? [],
    mappings: config.mappings,
    excludedColumns: config.excludedColumns ?? [],
  }
}

export function useImportForEdit(id: number | null) {
  const [data, setData] = useState<EditData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id === null) {
      setData(null)
      setError(null)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const { import: detail } = (await axiosImportsheet().get(
          `/importsheet/imports/${id}`,
        )) as unknown as { import: ImportDetail }

        const { spreadsheet } = (await axiosImportsheet().get(
          `/importsheet/sheets/${encodeURIComponent(detail.config.source.spreadsheetId)}`,
        )) as unknown as { spreadsheet: SpreadsheetDetails }

        const saved = detail.config.source.tab
        const tab = spreadsheet.tabs.find(t => t.sheetId === saved.sheetId) ?? {
          sheetId: saved.sheetId,
          title: saved.title,
          index: 0,
          rowCount: null,
          columnCount: null,
        }

        if (!active) return
        setData({ selection: { spreadsheet, tab }, initial: toInitial(detail) })
      } catch (e: unknown) {
        if (!active) return
        setError(
          e instanceof Error ? e.message : 'Falha ao carregar a importação.',
        )
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  return { data, loading, error }
}
