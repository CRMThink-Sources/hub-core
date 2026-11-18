'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  type ComboboxOption,
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  useTemplateVariableMappings,
  type ConnectorTemplate,
  type CrmEntityType,
  type CrmField,
} from '@/app/hooks/use-connector-templates'
import {
  fieldOptions,
  mappingsFromSelection,
  missingFieldVariables,
  selectionFromMappings,
  templateVariablesOf,
  type VariableSelection,
} from './template-variables-mapping'

type Props = {
  itemId: string
  /** Template aberto; `null` fecha o diálogo. */
  template: ConnectorTemplate | null
  onClose: () => void
}

/** Negócio: o tipo em que o operador mais abre o widget. */
const DEFAULT_ENTITY_TYPE_ID = 2

/**
 * Liga cada variável do corpo a um campo do Bitrix, por tipo de entidade. O widget
 * preenche as variáveis com esses campos ao abrir o template.
 *
 * Salvar fica bloqueado enquanto os campos ou o mapeamento salvo não carregaram:
 * gravar por cima de um mapeamento que não deu para ler apagaria o que já existia.
 */
export function TemplateVariablesDialog({ itemId, template, onClose }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const {
    loadEntityTypes,
    loadFields,
    loadMappings,
    saveMappings,
    loading,
    saving,
    error,
    setError,
  } = useTemplateVariableMappings()

  const [entityTypes, setEntityTypes] = useState<CrmEntityType[]>([])
  const [entityTypeId, setEntityTypeId] = useState(DEFAULT_ENTITY_TYPE_ID)
  const [fields, setFields] = useState<CrmField[]>([])
  const [selection, setSelection] = useState<VariableSelection>({})
  // Só quando os dois carregaram o diálogo aceita salvar.
  const [ready, setReady] = useState(false)
  // Resposta de um tipo de entidade que o operador já trocou é descartada.
  const request = useRef(0)

  const variables = useMemo(
    () => (template ? templateVariablesOf(template) : []),
    [template],
  )

  // Cada abertura começa limpa.
  useEffect(() => {
    if (!template) return
    setEntityTypeId(DEFAULT_ENTITY_TYPE_ID)
    setEntityTypes([])
    setFields([])
    setSelection({})
    setReady(false)
    setError(null)
    void loadEntityTypes().then(types => {
      if (types) setEntityTypes(types)
    })
  }, [template, loadEntityTypes, setError])

  useEffect(() => {
    if (!template) return
    const current = ++request.current
    setReady(false)
    void Promise.all([
      loadFields(entityTypeId),
      loadMappings(itemId, template, entityTypeId),
    ]).then(([loadedFields, mappings]) => {
      if (current !== request.current) return
      if (!loadedFields || !mappings) return
      setFields(loadedFields)
      setSelection(selectionFromMappings(mappings))
      setReady(true)
    })
  }, [template, itemId, entityTypeId, loadFields, loadMappings])

  const entityLabel = (type: CrmEntityType) =>
    type.kind === 'standard'
      ? t(`variaveisPadrao.entidade.${type.entityTypeId}`)
      : (type.title ?? `SPA ${type.entityTypeId}`)

  const entityOptions: ComboboxOption[] = entityTypes.map(type => ({
    value: String(type.entityTypeId),
    label: entityLabel(type),
  }))
  const selectedEntity =
    entityOptions.find(o => o.value === String(entityTypeId)) ?? null

  const noField: ComboboxOption = {
    value: '',
    label: t('variaveisPadrao.semCampo'),
  }
  const options: ComboboxOption[] = [
    noField,
    ...fieldOptions(fields, {
      sourceLabel: source => t(`variaveisPadrao.origem.${source}`),
      custom: t('variaveisPadrao.personalizado'),
    }),
  ]
  const missing = missingFieldVariables(selection, fields)

  const save = async () => {
    if (!template || !ready) return
    const saved = await saveMappings(
      itemId,
      template,
      entityTypeId,
      mappingsFromSelection(variables, selection),
    )
    if (saved) onClose()
  }

  return (
    <Dialog
      open={template !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('variaveisPadrao.titulo')}</DialogTitle>
          <DialogDescription>
            {t('variaveisPadrao.descricao', { nome: template?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('variaveisPadrao.tipoEntidade')}</Label>
            <Combobox
              items={entityOptions}
              value={selectedEntity}
              onValueChange={(option: ComboboxOption | null) => {
                if (option) setEntityTypeId(Number(option.value))
              }}
              disabled={entityOptions.length === 0 || saving}
            >
              <ComboboxTrigger placeholder={t('variaveisPadrao.carregando')} />
              <ComboboxContent
                searchPlaceholder={t('variaveisPadrao.buscarEntidade')}
                emptyText={t('variaveisPadrao.semResultado')}
              >
                {(option: ComboboxOption) => (
                  <ComboboxItem key={option.value} value={option}>
                    <span className="truncate">{option.label}</span>
                  </ComboboxItem>
                )}
              </ComboboxContent>
            </Combobox>
            <span className="text-xs text-muted-foreground">
              {t('variaveisPadrao.dicaEntidade')}
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {variables.map(variable => {
              const value = selection[variable] ?? ''
              const selected =
                options.find(option => option.value === value) ?? null
              return (
                <li key={variable} className="flex flex-col gap-1.5">
                  <Label>{`{{${variable}}}`}</Label>
                  <Combobox
                    key={`${entityTypeId}:${variable}:${options.length}`}
                    items={options}
                    value={selected ?? noField}
                    onValueChange={(option: ComboboxOption | null) =>
                      setSelection(prev => ({
                        ...prev,
                        [variable]: option?.value ?? '',
                      }))
                    }
                    disabled={!ready || saving}
                  >
                    <ComboboxTrigger
                      placeholder={
                        loading
                          ? t('variaveisPadrao.carregando')
                          : t('variaveisPadrao.semCampo')
                      }
                    />
                    <ComboboxContent
                      searchPlaceholder={t('variaveisPadrao.buscarCampo')}
                      emptyText={t('variaveisPadrao.semResultado')}
                    >
                      {(option: ComboboxOption) => (
                        <ComboboxItem key={option.value} value={option}>
                          <span className="truncate">{option.label}</span>
                          {option.description ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          ) : null}
                        </ComboboxItem>
                      )}
                    </ComboboxContent>
                  </Combobox>
                  {missing.includes(variable) && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {t('variaveisPadrao.campoNaoEncontrado')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('form.cancelar')}
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!ready || saving}
          >
            {saving
              ? t('variaveisPadrao.salvando')
              : t('variaveisPadrao.salvar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
