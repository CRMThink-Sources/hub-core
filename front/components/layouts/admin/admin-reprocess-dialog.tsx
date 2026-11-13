'use client'

import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldLabel } from '@/components/ui/field'

/** O que reprocessar e quais deles são `UNKNOWN` (exigem o aceite de duplicidade). */
export type ReprocessTarget = { ids: string[]; unknownCount: number }

type Props = {
  /** `null` fecha o diálogo. */
  target: ReprocessTarget | null
  title: string
  description: string
  isReprocessing: boolean
  acknowledged: boolean
  onAcknowledgedChange: (value: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmação de reprocesso, a mesma nas telas de falha de envio, de recebimento e na
 * página do cliente. Resultado indeterminado (`UNKNOWN`) exige o aceite explícito do
 * risco de o contato receber a mensagem duas vezes; sem ele, o botão fica desligado.
 */
export function AdminReprocessDialog({
  target,
  title,
  description,
  isReprocessing,
  acknowledged,
  onAcknowledgedChange,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation('admin/outbox-failures')

  return (
    <Dialog
      open={target !== null}
      onOpenChange={open => {
        if (!open && !isReprocessing) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {target && target.unknownCount > 0 && (
          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-medium">{t('unknownWarningTitle')}</p>
            <p>{t('unknownWarning', { count: target.unknownCount })}</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="acknowledge-duplicate"
                checked={acknowledged}
                onCheckedChange={(checked: boolean) =>
                  onAcknowledgedChange(checked)
                }
              />
              <FieldLabel htmlFor="acknowledge-duplicate">
                {t('unknownAcknowledge')}
              </FieldLabel>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isReprocessing}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              isReprocessing ||
              (target !== null && target.unknownCount > 0 && !acknowledged)
            }
          >
            {isReprocessing && <Loader2 className="size-4 animate-spin" />}
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
