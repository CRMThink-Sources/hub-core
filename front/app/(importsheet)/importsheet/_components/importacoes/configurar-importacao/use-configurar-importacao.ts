'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import type { ComboboxOption } from '@/components/ui/combobox'
import type {
  BitrixField,
  ColumnMapping,
  ColumnMappingInput,
  CreateImportInput,
  EntityCode,
  ImportConfig,
  ImportInitial,
  ImportScheduleInput,
  ImportSelection,
  MappingTarget,
  ResponsibleMatchBy,
  ScheduleType,
} from '../../types'
import { useTranslation } from 'react-i18next'
import { FEED_FIELDS, UNSET, fieldTypeKey } from './constants'

type TFn = (key: string, options?: Record<string, unknown>) => string

/** entityTypeId fixos do Bitrix p/ contato e empresa. */
const CONTACT_ENTITY_TYPE_ID = 3
const COMPANY_ENTITY_TYPE_ID = 4

function buildFieldOptions(
  fields: BitrixField[] | null,
  t: TFn,
): ComboboxOption[] {
  const base: ComboboxOption[] = [
    { value: UNSET, label: t('tabela.selecione') },
  ]
  if (!fields) return base
  return base.concat(
    fields.map(f => {
      const req = f.isRequired ? ' *' : ''
      const typeKey = fieldTypeKey(f.type)
      const tag = typeKey ? ` · ${t(`fieldTypes.${typeKey}`)}` : ''
      // subtítulo = nome técnico + type (ex. "UF_CRM_123 · enumeration").
      return {
        value: f.name,
        label: `${f.title}${req}${tag}`,
        description: `${f.name} · ${f.type}`,
      }
    }),
  )
}
import { deriveEntity } from './derive-entity'
import { useBitrixCategories } from './data/use-bitrix-categories'
import { useBitrixFields } from './data/use-bitrix-fields'
import { useBitrixSpas } from './data/use-bitrix-spas'
import { useSheetHeader } from './data/use-sheet-header'

export function useConfigurarImportacao(
  open: boolean,
  selection: ImportSelection,
  initial?: ImportInitial | null,
) {
  const { t } = useTranslation('importsheet/configurar-importacao')
  const { spreadsheet, tab } = selection
  const isEdit = !!initial

  // Garante que os mappings salvos sejam aplicados só na 1ª leitura do cabeçalho.
  const mappingsSeededRef = useRef(false)

  // Rastreia o último (entityCode, resolvedEntityTypeId) processado pelo cleanup effect,
  // para distinguir inicialização de mudança feita pelo usuário.
  const cleanupEntityRef = useRef<{
    code: EntityCode | ''
    typeId: number | null
  }>({
    code: '',
    typeId: null,
  })

  const [title, setTitle] = useState(spreadsheet.name)
  const [startRow, setStartRow] = useState(2)
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
  // Campos de contato (3) / empresa (4) — só quando o respectivo toggle liga.
  const { fields: contactFields } = useBitrixFields(
    open && createContact,
    false,
    CONTACT_ENTITY_TYPE_ID,
  )
  const { fields: companyFields } = useBitrixFields(
    open && createCompany,
    false,
    COMPANY_ENTITY_TYPE_ID,
  )
  const {
    header,
    loading: headerLoading,
    error: headerError,
  } = useSheetHeader(open, spreadsheet.id, selectedTab.title)

  const error = headerError ?? fieldsError ?? categoriesError ?? spasError

  // (Re)inicializa o formulário a cada abertura — defaults (criação) ou prefill (edição).
  useEffect(() => {
    if (!open) return
    mappingsSeededRef.current = false
    cleanupEntityRef.current = { code: '', typeId: null }
    setSelectedTabId(tab.sheetId)
    setExcluded([])
    setMappings([])

    if (initial) {
      setTitle(initial.title)
      setStartRow(initial.startRow)
      setEntityCode(initial.entityCode)
      setSpaTypeId(initial.spaTypeId)
      setCategoryId(initial.categoryId)
      setResponsibleColumnIndex(initial.responsible?.columnIndex ?? null)
      setResponsibleMatchBy(initial.responsible?.matchBy ?? 'id')
      setCreateContact(initial.options.createContact)
      setCreateCompany(initial.options.createCompany)
      setScheduleManual(initial.scheduleManual)
      setScheduleType(initial.scheduleType)
      setEveryHours(initial.everyHours)
      setWeekdays(initial.weekdays)
      setExcluded(initial.excludedColumns)
      return
    }

    setTitle(spreadsheet.name)
    setStartRow(2)
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
  }, [open, initial, spreadsheet.name, tab.sheetId])

  // Limpa campos ao trocar entidade-alvo. Ignora a inicialização (ref em branco = primeiro
  // disparo após abertura do modal) para não sobrescrever o prefill de edição.
  useEffect(() => {
    if (!open) return
    const prev = cleanupEntityRef.current
    const next = { code: entityCode, typeId: resolvedEntityTypeId }

    // Primeiro disparo após abertura: registra estado atual, não limpa nada.
    if (prev.code === '') {
      cleanupEntityRef.current = next
      return
    }

    const codeChanged = prev.code !== next.code
    const typeChanged = prev.typeId !== next.typeId

    // Nenhuma mudança relevante (e.g. apenas needsPipeline recalculado).
    if (!codeChanged && !typeChanged) return

    cleanupEntityRef.current = next

    if (codeChanged && !needsPipeline) setCategoryId(null)
    // Troca de entidade reseta o de-para: desliga destinos contato/empresa e zera os
    // mappings (campo, identificador e destino → main) — senão fica stale da anterior.
    setCreateContact(false)
    setCreateCompany(false)
    setMappings(prev =>
      prev.map(m => ({
        ...m,
        fieldName: null,
        isIdentifier: false,
        target: 'main' as MappingTarget,
      })),
    )
  }, [open, entityCode, resolvedEntityTypeId, needsPipeline])

  // (Re)constrói o de-para quando um novo cabeçalho é lido. Na edição, aplica os
  // mappings salvos (por columnIndex) na 1ª leitura.
  useEffect(() => {
    if (!header) return
    const applyInitial = !!initial && !mappingsSeededRef.current
    setMappings(
      header.columns.map(c => {
        const saved = applyInitial
          ? initial.mappings.find(m => m.columnIndex === c.index)
          : undefined
        return {
          columnIndex: c.index,
          fieldName: saved?.fieldName ?? null,
          isIdentifier: saved?.isIdentifier ?? false,
          target: saved?.target ?? 'main',
        }
      }),
    )
    setExcluded(applyInitial ? (initial.excludedColumns ?? []) : [])
    setResponsibleColumnIndex(
      applyInitial ? (initial.responsible?.columnIndex ?? null) : null,
    )
    if (applyInitial) mappingsSeededRef.current = true
  }, [header, initial])

  const fieldOptions = useMemo<ComboboxOption[]>(
    () => buildFieldOptions(fields, t),
    [fields, t],
  )
  const contactFieldOptions = useMemo<ComboboxOption[]>(
    () => buildFieldOptions(contactFields, t),
    [contactFields, t],
  )
  const companyFieldOptions = useMemo<ComboboxOption[]>(
    () => buildFieldOptions(companyFields, t),
    [companyFields, t],
  )
  const fieldOptionsByTarget = useMemo<Record<MappingTarget, ComboboxOption[]>>(
    () => ({
      main: fieldOptions,
      contact: contactFieldOptions,
      company: companyFieldOptions,
    }),
    [fieldOptions, contactFieldOptions, companyFieldOptions],
  )

  // Destinos disponíveis no de-para: Principal sempre; Contato/Empresa se ligados.
  const destinations = useMemo<
    { value: MappingTarget; label: string }[]
  >(() => {
    const list: { value: MappingTarget; label: string }[] = [
      { value: 'main', label: t('destinos.main') },
    ]
    if (createContact)
      list.push({ value: 'contact', label: t('destinos.contact') })
    if (createCompany)
      list.push({ value: 'company', label: t('destinos.company') })
    return list
  }, [createContact, createCompany, t])

  function setMapping(columnIndex: number, fieldName: string | null) {
    setMappings(prev => {
      // Dedup do mesmo campo só dentro do MESMO destino (main/contact/company).
      const target =
        prev.find(m => m.columnIndex === columnIndex)?.target ?? 'main'
      return prev.map(m => {
        if (m.columnIndex === columnIndex) {
          return {
            ...m,
            fieldName,
            isIdentifier: fieldName === null ? false : m.isIdentifier,
          }
        }
        if (
          fieldName !== null &&
          m.fieldName === fieldName &&
          m.target === target
        ) {
          return { ...m, fieldName: null, isIdentifier: false }
        }
        return m
      })
    })
  }

  function setMappingTarget(columnIndex: number, target: MappingTarget) {
    // Troca de destino zera o campo (conjunto de campos é outro).
    setMappings(prev =>
      prev.map(m =>
        m.columnIndex === columnIndex
          ? { ...m, target, fieldName: null, isIdentifier: false }
          : m,
      ),
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

  function restoreColumn(columnIndex: number) {
    setExcluded(prev => prev.filter(c => c !== columnIndex))
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
        target: m.target,
      }))
  }

  async function handleSave() {
    if (!canSave || !entityCode) return
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
        excludedColumns: excluded,
      }
      const payload: CreateImportInput = {
        title: title.trim(),
        startRow,
        schedule: buildSchedule(),
        config,
      }
      if (initial) {
        await axiosImportsheet().put(
          `/importsheet/imports/${initial.importId}`,
          payload,
        )
      } else {
        await axiosImportsheet().post('/importsheet/imports', payload)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return {
    spreadsheet,
    flags,
    error,
    isEdit,

    title,
    setTitle,
    startRow,
    setStartRow,
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
    fieldOptionsByTarget,
    destinations,
    mappings,
    visibleColumns,
    mappedCount,
    feedMappedCount,

    excluded,
    setMapping,
    setMappingTarget,
    toggleIdentifier,
    excludeColumn,
    restoreColumn,
    setFeedColumn,

    canSave,
    handleSave,
    isSaving,
  }
}

export type ConfigurarImportacaoState = ReturnType<
  typeof useConfigurarImportacao
>
