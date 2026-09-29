'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BotFlowSummary } from '@/shared/thinkzap-bot-flow'

/**
 * Exclusão é definitiva e some com o vínculo junto: o canal aberto volta ao atendimento
 * humano sem ninguém avisar. Por isso o aviso nomeia o canal quando existe um.
 */
export function ExcluirFluxoDialog({
  flow,
  canal,
  onOpenChange,
  onConfirm,
}: {
  /** `null` fecha. O fluxo fica no estado de quem abriu, para o texto nomear qual é. */
  flow: BotFlowSummary | null
  /** Canal em que o fluxo atende hoje. */
  canal: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}) {
  const { t } = useTranslation('thinkzap/bots/lista')
  const [excluindo, setExcluindo] = useState(false)

  async function confirmar() {
    setExcluindo(true)
    try {
      await onConfirm()
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <Dialog
      open={!!flow}
      onOpenChange={next => {
        if (!next && excluindo) return
        onOpenChange(next)
      }}
    >
      {/* Uma faixa só: com header, corpo e rodapé separados, três linhas de texto viravam
          um diálogo de meia tela. */}
      <DialogContent showCloseButton={false} className="max-w-sm">
        <div className="flex gap-3 p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </span>

          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-sm">{t('excluir.titulo')}</DialogTitle>
            <DialogDescription className="text-xs leading-snug">
              {t('excluir.descricao', { nome: flow?.name ?? '' })}
              {canal ? ` ${t('excluir.avisoCanal', { canal })}` : ''}
            </DialogDescription>

            <div className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={excluindo}
                onClick={() => onOpenChange(false)}
              >
                {t('excluir.cancelar')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={excluindo}
                onClick={() => void confirmar()}
              >
                {excluindo ? t('excluir.excluindo') : t('excluir.confirmar')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
