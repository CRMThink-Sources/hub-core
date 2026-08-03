'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useConnectorTemplates } from '@/app/hooks/use-connector-templates'
import { TemplatesLista } from './templates-lista'
import { TemplateForm } from './template-form'

type Props = {
  itemId: string
}

export function TemplatesTab({ itemId }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const { templates, loading, error, fetchTemplates, syncTemplates } =
    useConnectorTemplates()
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void fetchTemplates(itemId)
  }, [itemId, fetchTemplates])

  if (creating) {
    return (
      <TemplateForm
        itemId={itemId}
        onCreated={() => {
          setCreating(false)
          void fetchTemplates(itemId)
        }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('descricao')}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void syncTemplates(itemId)}
            disabled={loading}
          >
            {t('sincronizar')}
          </Button>
          <Button type="button" onClick={() => setCreating(true)}>
            {t('novo')}
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">{t('carregando')}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && <TemplatesLista templates={templates} />}
    </div>
  )
}
