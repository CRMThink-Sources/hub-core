'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DailyLimitUsage } from '@/app/hooks/use-line-api'
import { ConfigCard } from './config-card'
import { ConfirmModal } from './confirm-modal'
import { limiteDiarioValido } from './limites-alteracoes'

type Props = {
  ativo: boolean
  valor: string
  onAtivoChange: (ativo: boolean) => void
  onValorChange: (valor: string) => void
  /**
   * Uso do dia, como a api o calculou. `null` = contador não lido agora; o card
   * continua editável, só sem o uso.
   */
  uso: DailyLimitUsage | null
  /**
   * Limite **gravado** como ligado. A liberação lê o que está salvo, então ligar na
   * tela sem salvar não libera nada — e a ação fica travada até salvar.
   */
  limiteGravadoAtivo: boolean
  bloqueada: boolean
  /** Lança em falha: o diálogo continua aberto com a quantidade digitada. */
  onLiberar: (quantidade: number) => Promise<void>
  /** Zera o uso de hoje (enviadas e extras). Lança em falha: a confirmação fica aberta. */
  onZerar: () => Promise<void>
}

/**
 * Limite diário de envio da linha não oficial (Z-API).
 *
 * Toggle e valor entram na barra de salvamento da aba, como os demais ajustes. A
 * liberação temporária é ação imediata — como vincular canal —, e por isso não gera
 * pendência na barra.
 */
export function LimiteDiarioCard({
  ativo,
  valor,
  onAtivoChange,
  onValorChange,
  uso,
  limiteGravadoAtivo,
  bloqueada,
  onLiberar,
  onZerar,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/ajustes')
  const [dialogAberto, setDialogAberto] = useState(false)
  const [confirmarZerar, setConfirmarZerar] = useState(false)
  const [zerando, setZerando] = useState(false)

  async function handleZerar() {
    setZerando(true)
    try {
      await onZerar()
      setConfirmarZerar(false)
    } catch {
      // O aviso de erro é de quem chamou; a confirmação fica aberta para tentar de novo.
    } finally {
      setZerando(false)
    }
  }

  const valorInvalido = !limiteDiarioValido({ ativo, valor })

  return (
    <>
      <ConfigCard
        title={t('limiteDiario.titulo')}
        description={t('limiteDiario.descricao')}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="daily-limit-enabled"
              checked={ativo}
              disabled={bloqueada}
              onCheckedChange={next => onAtivoChange(next === true)}
            />
            <div className="min-w-0">
              <Label
                htmlFor="daily-limit-enabled"
                className={bloqueada ? 'text-muted-foreground' : undefined}
              >
                {t('limiteDiario.ativar')}
              </Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t('limiteDiario.ativarHint')}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="daily-limit-value">
              {t('limiteDiario.limite')}
            </Label>
            <Input
              id="daily-limit-value"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={valor}
              disabled={!ativo || bloqueada}
              onChange={e => onValorChange(e.target.value)}
              className="max-w-40"
            />
            {ativo && valorInvalido ? (
              <p className="text-sm text-destructive">
                {t('limiteDiario.valorInvalido')}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('limiteDiario.limiteHint')}
              </p>
            )}
          </div>

          <UsoDoDia uso={uso} />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!limiteGravadoAtivo || bloqueada}
              onClick={() => setDialogAberto(true)}
            >
              {t('limiteDiario.liberar')}
            </Button>
            {/* Ação imediata, como liberar: vale com o limite ligado ou desligado. */}
            <Button
              type="button"
              variant="outline"
              disabled={bloqueada || zerando}
              onClick={() => setConfirmarZerar(true)}
            >
              {t('limiteDiario.zerar')}
            </Button>
            {!limiteGravadoAtivo && !bloqueada && (
              <p className="text-sm text-muted-foreground">
                {t('limiteDiario.liberarHintSalvar')}
              </p>
            )}
          </div>
        </div>
      </ConfigCard>

      <ConfirmModal
        isOpen={confirmarZerar}
        title={t('limiteDiario.zerarTitulo')}
        message={t('limiteDiario.zerarDescricao')}
        confirmLabel={
          zerando ? t('limiteDiario.zerando') : t('limiteDiario.confirmarZerar')
        }
        cancelLabel={t('cancelar')}
        loading={zerando}
        onConfirm={() => void handleZerar()}
        onClose={() => setConfirmarZerar(false)}
      />

      {dialogAberto && (
        <LiberarLimiteDialog
          onClose={() => setDialogAberto(false)}
          onConfirm={async quantidade => {
            await onLiberar(quantidade)
            setDialogAberto(false)
          }}
        />
      )}
    </>
  )
}

function UsoDoDia({ uso }: { uso: DailyLimitUsage | null }) {
  const { t } = useTranslation('thinkzap/configuracoes/ajustes')

  if (uso === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('limiteDiario.usoIndisponivel')}
      </p>
    )
  }

  if (
    !uso.enabled ||
    uso.effectiveLimit === null ||
    uso.remainingPercent === null
  ) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm text-foreground">
          {t('limiteDiario.semLimite', { sent: uso.sentToday })}
        </p>
      </div>
    )
  }

  // Barra do consumido; o texto mostra o que falta, que é a pergunta de quem olha.
  const consumido = Math.min(100, 100 - uso.remainingPercent)

  return (
    <div
      className={
        uso.reached
          ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-4'
          : 'rounded-lg border border-border bg-muted/40 p-4'
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {t('limiteDiario.enviadasDe', {
            sent: uso.sentToday,
            effective: uso.effectiveLimit,
          })}
        </p>
        <p
          className={
            uso.reached
              ? 'text-sm font-medium text-destructive'
              : 'text-sm text-muted-foreground'
          }
        >
          {t('limiteDiario.restante', { percent: uso.remainingPercent })}
        </p>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={uso.effectiveLimit}
        aria-valuenow={Math.min(uso.sentToday, uso.effectiveLimit)}
      >
        <div
          className={
            uso.reached ? 'h-full bg-destructive' : 'h-full bg-primary'
          }
          style={{ width: `${consumido}%` }}
        />
      </div>

      {uso.extraToday > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('limiteDiario.extrasHoje', {
            limit: uso.limit,
            extra: uso.extraToday,
          })}
        </p>
      )}

      {uso.reached && (
        <p className="mt-2 text-sm text-destructive">
          {t('limiteDiario.atingido')}
        </p>
      )}
    </div>
  )
}

function LiberarLimiteDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (quantidade: number) => Promise<void>
}) {
  const { t } = useTranslation('thinkzap/configuracoes/ajustes')
  const [quantidade, setQuantidade] = useState('')
  const [enviando, setEnviando] = useState(false)

  const valida = limiteDiarioValido({ ativo: true, valor: quantidade })

  async function confirmar() {
    if (!valida || enviando) return

    setEnviando(true)
    try {
      await onConfirm(Number(quantidade.trim()))
    } catch {
      // O pai já mostrou o erro; o diálogo fica aberto com o que foi digitado.
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next, details) => {
        if (next || enviando) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('limiteDiario.liberarTitulo')}</DialogTitle>
          <DialogDescription>
            {t('limiteDiario.liberarDescricao')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2">
            <Label htmlFor="daily-limit-extra">
              {t('limiteDiario.quantidade')}
            </Label>
            <Input
              id="daily-limit-extra"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              autoFocus
              value={quantidade}
              disabled={enviando}
              onChange={e => setQuantidade(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void confirmar()
              }}
              className="max-w-40"
            />
            {quantidade !== '' && !valida && (
              <p className="text-sm text-destructive">
                {t('limiteDiario.valorInvalido')}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            {t('cancelar')}
          </Button>
          <Button
            onClick={() => void confirmar()}
            disabled={!valida || enviando}
          >
            {enviando
              ? t('limiteDiario.liberando')
              : t('limiteDiario.confirmarLiberar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
