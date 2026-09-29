'use client'

import { Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type Props = {
  dirtyCount: number
  saving: boolean
  /** Além de haver alteração: nome válido e linha habilitada. */
  canSave: boolean
  onSave: () => void
  onDiscard: () => void
}

/**
 * Barra de salvamento da aba de ajustes.
 *
 * Fora de qualquer card, no rodapé da aba: o botão antes morava dentro de
 * Comportamento e parecia salvar só os toggles, embora gravasse também o nome.
 *
 * Sempre visível, mesmo sem alteração. Uma barra que só surge quando há o que
 * salvar some justo quando o usuário procura onde salvar, e empurra o layout.
 *
 * As margens negativas encostam a barra nas bordas da casca da configuração, que
 * usa o mesmo `px-4 sm:px-6 lg:px-8` da tela de permissões.
 */
export function SaveChangesBar({
  dirtyCount,
  saving,
  canSave,
  onSave,
  onDiscard,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/ajustes')
  const dirty = dirtyCount > 0

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          {dirty && (
            <span className="size-2 shrink-0 rounded-full bg-amber-500" />
          )}
          <span className={dirty ? 'font-medium text-foreground' : undefined}>
            {dirty
              ? t('barra.alteracoes', { count: dirtyCount })
              : t('barra.semAlteracoes')}
          </span>
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || saving}
            onClick={onDiscard}
          >
            {t('barra.descartar')}
          </Button>
          <Button
            type="button"
            disabled={!dirty || !canSave || saving}
            onClick={onSave}
            className="sm:min-w-[180px]"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving ? t('barra.salvando') : t('barra.salvar')}
          </Button>
        </div>
      </div>
    </div>
  )
}
