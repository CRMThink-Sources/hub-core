'use client'

import { useEffect, useMemo, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { ComboboxOption } from '@/components/ui/combobox'
import type {
  ColumnMapping,
  ColumnMappingInput,
  CreateImportInput,
  EntityCode,
  ImportConfig,
  ImportScheduleInput,
  ImportSelection,
  ResponsibleMatchBy,
  ScheduleType,
} from '../../types'
import { FEED_FIELDS, UNSET } from './constants'
import { deriveEntity } from './derive-entity'
import { useBitrixCategories } from './data/use-bitrix-categories'
import { useBitrixFields } from './data/use-bitrix-fields'
import { useBitrixSpas } from './data/use-bitrix-spas'
import { useSheetHeader } from './data/use-sheet-header'

export function useConfigurarImportacao(
  open: boolean,
  selection: ImportSelection,
) {
  const { spreadsheet, tab } = selection

  const [title, setTitle] = useState(spreadsheet.name)
  const [selectedTabId, setSelectedTabId] = useState(tab.sheetId)
  const [entityCode, setEntityCode] = useState<EntityCode | ''>('')
  const [spaTypeId, setSpaTypeId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const [responsibleColumnIndex, setResponsibleColumnIndex] = useState<
    number | null
  >(null)
  const [responsibleMatchBy, setResponsibleMatchBy] =
    useState<ResponsibleMatchBy>('id')
  const [createContact, setCreateContact] = useState(false)
  const [createCompany, setCreateCompany] = useState(false)

  const [scheduleManual, setScheduleManual] = useState(false)
  const [scheduleType, setScheduleType] = useState<ScheduleType>('hours')
  const [everyHours, setEveryHours] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([])

  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [excluded, setExcluded] = useState<number[]>([])

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const flags = deriveEntity(entityCode, spaTypeId)
  const {
    entity,
    needsPipeline,
    needsSpa,
    isTask,
    isFeed,
    perColumn,
    resolvedEntityTypeId,
    showCreateContact,
    showCreateCompany,
  } = flags

  const selectedTab =
    spreadsheet.tabs.find(t => t.sheetId === selectedTabId) ?? tab

  const { spas, error: spasError } = useBitrixSpas(open)
  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useBitrixCategories(open, needsPipeline)
  const {
    fields,
    loading: fieldsLoading,
    error: fieldsError,
  } = useBitrixFields(open, isTask, resolvedEntityTypeId)
  const {
    header,
    loading: headerLoading,
    error: headerError,
  } = useSheetHeader(open, spreadsheet.id, selectedTab.title)

  const error = headerError ?? fieldsError ?? categoriesError ?? spasError

  // Reseta o formulário a cada abertura.
  useEffect(() => {
    if (!open) return
    setTitle(spreadsheet.name)
    setSelectedTabId(tab.sheetId)
    setEntityCode('')
    setSpaTypeId(null)
    setCategoryId(null)
    setResponsibleColumnIndex(null)
    setResponsibleMatchBy('id')
    setCreateContact(false)
    setCreateCompany(false)
    setScheduleManual(false)
    setScheduleType('hours')
    setEveryHours(1)
    setWeekdays([])
    setMappings([])
    setExcluded([])
    setSaveError(null)
  }, [open, spreadsheet.name, tab.sheetId])

  // Limpa o campo escolhido ao trocar a entidade-alvo; limpa pipeline se não aplicável.
  useEffect(() => {
    if (!open) return
    if (!needsPipeline) setCategoryId(null)
    setMappings(prev =>
      prev.map(m => ({ ...m, fieldName: null, isIdentifier: false })),
    )
  }, [open, entityCode, resolvedEntityTypeId, needsPipeline])

  // (Re)constrói o de-para quando um novo cabeçalho é lido.
  useEffect(() => {
    if (!header) return
    setMappings(
      header.columns.map(c => ({
        columnIndex: c.index,
        fieldName: null,
        isIdentifier: false,
      })),
    )
    setExcluded([])
    setResponsibleColumnIndex(null)
  }, [header])

  const fieldOptions = useMemo<ComboboxOption[]>(() => {
    const base: ComboboxOption[] = [{ value: UNSET, label: 'Selecione…' }]
    if (!fields) return base
    return base.concat(
      fields.map(f => ({
        value: f.name,
        label: f.isRequired ? `${f.title} *` : f.title,
      })),
    )
  }, [fields])

  function setMapping(columnIndex: number, fieldName: string | null) {
    setMappings(prev =>
      prev.map(m => {
        if (m.columnIndex === columnIndex) {
          return {
            ...m,
            fieldName,
            isIdentifier: fieldName === null ? false : m.isIdentifier,
          }
        }
        if (fieldName !== null && m.fieldName === fieldName) {
          return { ...m, fieldName: null, isIdentifier: false }
        }
        return m
      }),
    )
  }

  function toggleIdentifier(columnIndex: number, isIdentifier: boolean) {
    setMappings(prev =>
      prev.map(m =>
        m.columnIndex === columnIndex ? { ...m, isIdentifier } : m,
      ),
    )
  }

  function excludeColumn(columnIndex: number) {
    setExcluded(prev =>
      prev.includes(columnIndex) ? prev : [...prev, columnIndex],
    )
    if (responsibleColumnIndex === columnIndex) setResponsibleColumnIndex(null)
  }

  function toggleWeekday(day: number) {
    setWeekdays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    )
  }

  function setFeedColumn(code: string, columnIndex: number | null) {
    if (columnIndex === null) {
      const current =
        mappings.find(m => m.fieldName === code)?.columnIndex ?? null
      if (current !== null) setMapping(current, null)
      return
    }
    setMapping(columnIndex, code)
  }

  const visibleColumns =
    header?.columns.filter(c => !excluded.includes(c.index)) ?? []
  const mappedCount = visibleColumns.filter(
    c => mappings.find(m => m.columnIndex === c.index)?.fieldName != null,
  ).length
  const allMapped =
    visibleColumns.length > 0 && mappedCount === visibleColumns.length

  const feedMappedCount = FEED_FIELDS.filter(f =>
    mappings.some(m => m.fieldName === f.code),
  ).length
  const mappingValid = isFeed
    ? feedMappedCount === FEED_FIELDS.length
    : allMapped

  const scheduleValid =
    scheduleManual ||
    (scheduleType === 'hours'
      ? everyHours >= 1 && everyHours <= 23
      : weekdays.length > 0)

  const canSave =
    title.trim().length > 0 &&
    entityCode !== '' &&
    (!needsPipeline || categoryId !== null) &&
    (!needsSpa || spaTypeId !== null) &&
    header !== null &&
    (isFeed || fields !== null) &&
    mappingValid &&
    scheduleValid

  function buildSchedule(): ImportScheduleInput {
    if (scheduleManual) return { mode: 'manual' }
    if (scheduleType === 'hours') return { mode: 'hours', everyHours }
    return { mode: 'days', weekdays }
  }

  function buildMappings(): ColumnMappingInput[] {
    return mappings
      .filter(m => m.fieldName !== null && !excluded.includes(m.columnIndex))
      .map(m => ({
        columnIndex: m.columnIndex,
        columnLabel:
          header?.columns.find(c => c.index === m.columnIndex)?.label ?? '',
        fieldName: m.fieldName as string,
        isIdentifier: m.isIdentifier,
      }))
  }

  async function handleSave() {
    if (!canSave || !entityCode) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const config: ImportConfig = {
        source: {
          spreadsheetId: spreadsheet.id,
          spreadsheetName: spreadsheet.name,
          tab: { sheetId: selectedTab.sheetId, title: selectedTab.title },
        },
        target: {
          entityCode,
          entityTypeId: resolvedEntityTypeId,
          categoryId: needsPipeline ? categoryId : null,
        },
        responsible:
          responsibleColumnIndex === null
            ? null
            : {
                columnIndex: responsibleColumnIndex,
                matchBy: responsibleMatchBy,
              },
        options: {
          createContact: showCreateContact ? createContact : false,
          createCompany: showCreateCompany ? createCompany : false,
        },
        mappings: buildMappings(),
      }
      const payload: CreateImportInput = {
        title: title.trim(),
        schedule: buildSchedule(),
        config,
      }
      await axiosImportsheet().post('/importsheet/imports', payload)
    } catch (e) {
      setSaveError('Erro ao salvar a importação. Tente novamente.')
      throw e
    } finally {
      setIsSaving(false)
    }
  }

  return {
    spreadsheet,
    flags,
    error,

    title,
    setTitle,
    selectedTabId,
    setSelectedTabId,
    selectedTab,

    entityCode,
    setEntityCode,
    spaTypeId,
    setSpaTypeId,
    spas,

    categoryId,
    setCategoryId,
    categories,
    categoriesLoading,

    responsibleColumnIndex,
    setResponsibleColumnIndex,
    responsibleMatchBy,
    setResponsibleMatchBy,

    createContact,
    setCreateContact,
    createCompany,
    setCreateCompany,

    scheduleManual,
    setScheduleManual,
    scheduleType,
    setScheduleType,
    everyHours,
    setEveryHours,
    weekdays,
    toggleWeekday,

    header,
    headerLoading,
    fields,
    fieldsLoading,
    fieldOptions,
    mappings,
    visibleColumns,
    mappedCount,
    feedMappedCount,

    setMapping,
    toggleIdentifier,
    excludeColumn,
    setFeedColumn,

    canSave,
    handleSave,
    isSaving,
    saveError,
  }
}

export type ConfigurarImportacaoState = ReturnType<
  typeof useConfigurarImportacao
>
