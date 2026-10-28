'use client'

import { Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  useConnectorTemplates,
  type ConnectorTemplate,
} from '@/app/hooks/use-connector-templates'
import { TemplateCard } from './template-card'
import { TemplateDefaultImageDialog } from './template-default-image-dialog'
import { TemplateDetailsSheet } from './template-details-sheet'
import { TemplateForm } from './template-form'
import { TemplatesToolbar } from './templates-toolbar'
import {
  EMPTY_FILTERS,
  filterTemplates,
  type TemplateFilters,
} from './template-view'

type Props = {
  itemId: string
}

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; template: ConnectorTemplate }

/**
 * Aba de templates da linha oficial: lista com busca e filtros, e o formulário de
 * criação e edição no lugar dela. Imagem padrão e detalhes abrem por cima da
 * lista, sem perder a busca.
 */
export function TemplatesTab({ itemId }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const {
    templates,
    loading,
    error,
    fetchTemplates,
    syncTemplates,
    setTemplates,
  } = useConnectorTemplates()
  const [view, setView] = useState<View>({ kind: 'list' })
  const [filters, setFilters] = useState<TemplateFilters>(EMPTY_FILTERS)
  const [details, setDetails] = useState<ConnectorTemplate | null>(null)
  const [defaultImageFor, setDefaultImageFor] =
    useState<ConnectorTemplate | null>(null)
  // Só o primeiro carregamento mostra o esqueleto; sincronizar mantém a lista.
  const [loadedOnce, setLoadedOnce] = useState(false)

  useEffect(() => {
    void fetchTemplates(itemId).then(() => setLoadedOnce(true))
  }, [itemId, fetchTemplates])

  const shown = useMemo(
    () => filterTemplates(templates, filters),
    [templates, filters],
  )

  if (view.kind !== 'list') {
    return (
      <TemplateForm
        // Remonta ao trocar de template: o estado inicial vem dele.
        key={view.kind === 'edit' ? view.template.id : 'new'}
        itemId={itemId}
        template={view.kind === 'edit' ? view.template : undefined}
        onSaved={() => {
          setView({ kind: 'list' })
          void fetchTemplates(itemId)
        }}
        onCancel={() => setView({ kind: 'list' })}
      />
    )
  }

  const openEdit = (template: ConnectorTemplate) => {
    setDetails(null)
    setView({ kind: 'edit', template })
  }
  const openDefaultImage = (template: ConnectorTemplate) => {
    setDetails(null)
    setDefaultImageFor(template)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{t('tab')}</h2>
          <p className="text-sm text-muted-foreground">{t('descricao')}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void syncTemplates(itemId)}
            disabled={loading}
          >
            <RefreshCw
              className={`size-4 ${loading && loadedOnce ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden
            />
            {t('sincronizar')}
          </Button>
          <Button type="button" onClick={() => setView({ kind: 'create' })}>
            <Plus className="size-4" aria-hidden />
            {t('novo')}
          </Button>
        </div>
      </div>

      {templates.length > 0 && (
        <TemplatesToolbar
          filters={filters}
          onChange={setFilters}
          total={templates.length}
          shown={shown.length}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {!loadedOnce && loading ? (
          <TemplatesSkeleton label={t('carregando')} />
        ) : error ? (
          <div role="alert" className="flex flex-col items-start gap-2 p-6">
            <p className="text-sm text-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchTemplates(itemId)}
            >
              {t('estados.tentarDeNovo')}
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <div>
              <p className="font-medium text-foreground">
                {t('estados.vazioTitulo')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('estados.vazioTexto')}
              </p>
            </div>
            <Button type="button" onClick={() => setView({ kind: 'create' })}>
              <Plus className="size-4" aria-hidden />
              {t('estados.criarPrimeiro')}
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-start gap-2 p-6">
            <p className="text-sm text-foreground">
              {t('estados.semResultado')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              {t('toolbar.limpar')}
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => openEdit(template)}
                onDefaultImage={() => openDefaultImage(template)}
                onDetails={() => setDetails(template)}
              />
            ))}
          </ul>
        )}
      </div>

      <TemplateDetailsSheet
        template={details}
        onClose={() => setDetails(null)}
        onEdit={openEdit}
        onDefaultImage={openDefaultImage}
      />
      <TemplateDefaultImageDialog
        itemId={itemId}
        template={defaultImageFor}
        onClose={() => setDefaultImageFor(null)}
        onSaved={(saved, headerImageUrl) => {
          setTemplates(list =>
            list.map(item =>
              item.id === saved.id
                ? { ...item, defaultImageUrl: headerImageUrl }
                : item,
            ),
          )
          setDefaultImageFor(null)
        }}
      />
    </div>
  )
}

/** O layout final com barras planas no lugar do conteúdo; sem brilho animado. */
function TemplatesSkeleton({ label }: { label: string }) {
  return (
    <ul className="divide-y divide-border" aria-busy="true" aria-label={label}>
      {[0, 1, 2].map(i => (
        <li key={i} className="flex gap-4 px-4 py-4">
          <span className="h-[42px] w-20 flex-none rounded-md bg-muted" />
          <span className="flex flex-1 flex-col gap-2 pt-0.5">
            <span className="h-4 w-40 rounded bg-muted" />
            <span className="h-3 w-28 rounded bg-muted" />
            <span className="h-3 w-3/4 rounded bg-muted" />
          </span>
        </li>
      ))}
    </ul>
  )
}
