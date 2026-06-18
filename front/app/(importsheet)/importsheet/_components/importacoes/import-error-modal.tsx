'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangleIcon, Loader2Icon, RotateCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type {
  ImportErrorRow,
  ImportErrorsResponse,
  ImportRunErrorDetail,
} from '../types'

type Props = {
  importId: number
  onClose: () => void
  onResolved: () => void
}

export function ImportErrorModal({ importId, onClose, onResolved }: Props) {
  const { t } = useTranslation('importsheet/importacoes/lista')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ImportRunErrorDetail | null>(null)
  const [reprocessing, setReprocessing] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void axiosImportsheet()
      .get(`/importsheet/imports/${importId}/errors`)
      .then(res => {
        if (active) setDetail((res as unknown as ImportErrorsResponse).detail)
      })
      .catch(() => {
        if (active) toast.error(t('erros.toastCarregar'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [importId, t])

  async function reprocess(rows: number[]) {
    setReprocessing(true)
    try {
      const res = (await axiosImportsheet().post(
        `/importsheet/imports/${importId}/reprocess`,
        { rows },
      )) as unknown as { errorRows: ImportErrorRow[] }

      onResolved()
      if (res.errorRows.length === 0) {
        toast.success(t('erros.toastResolvido'))
        onClose()
        return
      }
      setDetail(d => (d ? { ...d, rows: res.errorRows } : d))
      // As linhas que cliquei seguem na lista = re-falharam (ex: match ambíguo).
      const stillFailing = rows.filter(r =>
        res.errorRows.some(e => e.row === r),
      )
      if (stillFailing.length > 0) {
        toast.warning(t('erros.toastAindaFalhou'))
      } else {
        toast.success(t('erros.toastReprocessado'))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('erros.toastErro'))
    } finally {
      setReprocessing(false)
    }
  }

  const isPartial = detail?.kind === 'partial'
  const isFatal = detail?.kind === 'fatal'
  // Fatal também pode trazer rows acumuladas antes da falha da página.
  const rows = detail
    ? detail.kind === 'partial'
      ? detail.rows
      : (detail.rows ?? [])
    : []

  return (
    <Dialog
      open
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPartial ? t('erros.tituloPartial') : t('erros.tituloFatal')}
          </DialogTitle>
          <DialogDescription>
            {isPartial
              ? t('erros.descricaoPartial')
              : t('erros.descricaoFatal')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon className="animate-spin text-muted-foreground" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground">
              {t('erros.semErro')}
            </p>
          ) : (
            <>
              {isFatal && detail.kind === 'fatal' && (
                <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <span className="flex items-center gap-2">
                    <AlertTriangleIcon className="size-4 shrink-0" />
                    {detail.message}
                  </span>
                  {detail.cursorRow > 0 && (
                    <span className="text-xs opacity-80">
                      {t('erros.retomada', { linha: detail.cursorRow })}
                    </span>
                  )}
                </div>
              )}
              {rows.length > 0 && (
                <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                  {rows.map(r => (
                    <li
                      key={r.row}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {t('erros.linha', { linha: r.row })}
                        </p>
                        <p className="text-xs break-words text-muted-foreground">
                          {r.message}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reprocessing}
                        onClick={() => void reprocess([r.row])}
                      >
                        <RotateCwIcon />
                        {t('erros.reprocessar')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('erros.fechar')}
          </Button>
          {rows.length > 0 && (
            <Button
              disabled={reprocessing}
              onClick={() => void reprocess(rows.map(r => r.row))}
            >
              {reprocessing && <Loader2Icon className="animate-spin" />}
              {t('erros.reprocessarTodas')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
