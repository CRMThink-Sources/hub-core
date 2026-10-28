'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ConnectorTemplate } from '@/app/hooks/use-connector-templates'
import { templateButtonsOf } from './template-buttons'
import { templateHeaderOf } from './template-header'
import { StatusPill } from './template-card'
import { TemplatePreview } from './template-preview'
import { canEditTemplate, componentText } from './template-view'

type Props = {
  template: ConnectorTemplate | null
  onClose: () => void
  onEdit: (template: ConnectorTemplate) => void
  onDefaultImage: (template: ConnectorTemplate) => void
}

/** O template inteiro: preview como o contato recebe e os dados dele. */
export function TemplateDetailsSheet({
  template,
  onClose,
  onEdit,
  onDefaultImage,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')

  return (
    <Sheet
      open={template !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {template && (
          <TemplateDetails
            template={template}
            onEdit={() => onEdit(template)}
            onDefaultImage={() => onDefaultImage(template)}
            t={t}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function TemplateDetails({
  template,
  onEdit,
  onDefaultImage,
  t,
}: {
  template: ConnectorTemplate
  onEdit: () => void
  onDefaultImage: () => void
  t: ReturnType<typeof useTranslation>['t']
}) {
  const hasImage = templateHeaderOf(template.components) === 'IMAGE'
  const buttons = templateButtonsOf(template.components)
  const editable = canEditTemplate(template.status)

  const rows: [string, string][] = [
    [t('detalhes.categoria'), t(`categoria.${template.category}`)],
    [t('detalhes.idioma'), template.language],
    [
      t('detalhes.cabecalho'),
      hasImage ? t('form.cabecalho.imagem') : t('form.cabecalho.nenhum'),
    ],
    [t('detalhes.botoes'), buttons.length ? String(buttons.length) : '—'],
  ]

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <SheetTitle className="truncate">{template.name}</SheetTitle>
          <StatusPill status={template.status} />
        </div>
        <SheetDescription>{t('detalhes.descricao')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-4 pb-6">
        <TemplatePreview
          header={hasImage ? 'IMAGE' : 'NONE'}
          imageUrl={template.defaultImageUrl}
          body={componentText(template.components, 'BODY')}
          footer={componentText(template.components, 'FOOTER')}
          buttons={buttons.map(button => ({
            type: button.type === 'OTHER' ? 'QUICK_REPLY' : button.type,
            text: button.text,
          }))}
        />

        <dl className="flex flex-col">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0"
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        {hasImage && (
          <p className="text-sm text-muted-foreground">
            {template.defaultImageUrl
              ? t('detalhes.comImagemPadrao')
              : t('lista.semImagemPadrao')}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onEdit} disabled={!editable}>
            {t('acoes.editar')}
          </Button>
          {hasImage && (
            <Button type="button" variant="outline" onClick={onDefaultImage}>
              {t('acoes.imagemPadrao')}
            </Button>
          )}
        </div>
        {!editable && (
          <p className="-mt-4 text-xs text-muted-foreground">
            {t('acoes.editarEmAnalise')}
          </p>
        )}
      </div>
    </>
  )
}
