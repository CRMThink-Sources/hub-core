'use client'

import { MoreHorizontalIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ConnectorTemplate } from '@/app/hooks/use-connector-templates'
import { templateHeaderOf } from './template-header'
import { canEditTemplate } from './template-view'

type Props = {
  template: ConnectorTemplate
  onEdit: () => void
  onDefaultImage: () => void
  onDetails: () => void
}

/** Ações de um template: editar, imagem padrão do envio (só com imagem), detalhes. */
export function TemplateActionsMenu({
  template,
  onEdit,
  onDefaultImage,
  onDetails,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const editable = canEditTemplate(template.status)
  const hasImage = templateHeaderOf(template.components) === 'IMAGE'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('acoes.menu', { nome: template.name })}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent className="min-w-56">
        <DropdownMenuItem
          disabled={!editable}
          onClick={onEdit}
          className="flex-col items-start gap-0"
        >
          {t('acoes.editar')}
          {!editable && (
            <span className="text-xs text-muted-foreground">
              {t('acoes.editarEmAnalise')}
            </span>
          )}
        </DropdownMenuItem>
        {hasImage && (
          <DropdownMenuItem onClick={onDefaultImage}>
            {t('acoes.imagemPadrao')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDetails}>
          {t('acoes.detalhes')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
