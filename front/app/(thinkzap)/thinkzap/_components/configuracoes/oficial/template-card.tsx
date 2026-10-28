'use client'

import { ImageOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ConnectorTemplate,
  TemplateStatus,
} from '@/app/hooks/use-connector-templates'
import { templateButtonsOf } from './template-buttons'
import { templateHeaderOf } from './template-header'
import { TemplateActionsMenu } from './template-actions-menu'
import { componentText } from './template-view'

/** Pílula de status: tom claro com texto escuro do mesmo matiz, e um ponto. */
export const STATUS_PILL: Record<
  TemplateStatus,
  { pill: string; dot: string }
> = {
  APPROVED: {
    pill: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  PENDING: {
    pill: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  REJECTED: {
    pill: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300',
    dot: 'bg-red-500',
  },
}

export function StatusPill({ status }: { status: TemplateStatus }) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  return (
    <span
      className={`inline-flex h-5 flex-none items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap ${STATUS_PILL[status].pill}`}
    >
      <span
        className={`size-1.5 rounded-full ${STATUS_PILL[status].dot}`}
        aria-hidden
      />
      {t(`status.${status}`)}
    </span>
  )
}

type Props = {
  template: ConnectorTemplate
  onEdit: () => void
  onDefaultImage: () => void
  onDetails: () => void
}

/**
 * Uma linha da lista de templates. A miniatura é a imagem padrão do envio; template
 * com imagem sem ela mostra o aviso e a ação de definir, porque o widget e o robô
 * vão pedir a imagem em todo envio até lá.
 */
export function TemplateCard({
  template,
  onEdit,
  onDefaultImage,
  onDetails,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const hasImage = templateHeaderOf(template.components) === 'IMAGE'
  const missingDefault = hasImage && !template.defaultImageUrl
  const body = componentText(template.components, 'BODY')
  const buttons = templateButtonsOf(template.components)

  return (
    <li className="flex gap-4 px-4 py-4">
      <button
        type="button"
        onClick={missingDefault ? onDefaultImage : onDetails}
        aria-label={
          missingDefault
            ? t('acoes.imagemPadrao')
            : t('acoes.detalhesDe', { nome: template.name })
        }
        className="h-[42px] w-20 flex-none overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {hasImage && template.defaultImageUrl ? (
          <img
            src={template.defaultImageUrl}
            alt=""
            className="size-full bg-muted object-cover"
          />
        ) : missingDefault ? (
          <span className="flex size-full items-center justify-center rounded-md border border-dashed border-amber-400 text-amber-600 dark:text-amber-400">
            <ImageOff className="size-4" aria-hidden />
          </span>
        ) : (
          <span className="block size-full bg-muted" aria-hidden />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onDetails}
            className="truncate text-left font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {template.name}
          </button>
          <StatusPill status={template.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t(`categoria.${template.category}`)} · {template.language}
          {hasImage ? ` · ${t('lista.imagem')}` : ''}
          {buttons.length > 0
            ? ` · ${t('lista.botoes', { count: buttons.length })}`
            : ''}
        </p>
        {body && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{body}</p>
        )}
        {missingDefault && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t('lista.semImagemPadrao')}{' '}
            <button
              type="button"
              onClick={onDefaultImage}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t('lista.definirImagem')}
            </button>
          </p>
        )}
      </div>

      <div className="flex-none self-start">
        <TemplateActionsMenu
          template={template}
          onEdit={onEdit}
          onDefaultImage={onDefaultImage}
          onDetails={onDetails}
        />
      </div>
    </li>
  )
}
