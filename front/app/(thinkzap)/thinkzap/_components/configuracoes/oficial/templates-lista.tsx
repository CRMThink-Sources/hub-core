'use client'

import { useTranslation } from 'react-i18next'
import type {
  ConnectorTemplate,
  TemplateStatus,
} from '@/app/hooks/use-connector-templates'
import { templateButtonsOf } from './template-buttons'
import { templateHeaderOf } from './template-header'

const STATUS_CLASS: Record<TemplateStatus, string> = {
  APPROVED:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  PENDING:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  REJECTED: 'border-destructive/30 bg-destructive/10 text-destructive',
}

type Props = {
  templates: ConnectorTemplate[]
}

export function TemplatesLista({ templates }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')

  if (templates.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {t('lista.vazio')}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {templates.map(template => {
        const body = template.components.find(c => c.type === 'BODY')?.text
        const buttons = templateButtonsOf(template.components)
        return (
          <li
            key={template.id}
            className="flex flex-col gap-1 rounded-md border border-border bg-background px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {template.name}
                {templateHeaderOf(template.components) === 'IMAGE' && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('lista.imagem')}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_CLASS[template.status]}`}
              >
                {t(`status.${template.status}`)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t(`categoria.${template.category}`)} · {template.language}
            </span>
            {body && (
              <span className="line-clamp-2 text-sm text-muted-foreground">
                {body}
              </span>
            )}
            {buttons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {buttons.map(button => (
                  <span
                    key={button.index}
                    className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {button.text ? `${button.text} · ` : ''}
                    {t(`botoes.tipo.${button.type}`)}
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
