'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type Props = {
  /** Nome da linha, para a confirmação nomear o que vai sumir. */
  nome: string
  /**
   * Esta é a **última** linha ativa do contrato dela.
   *
   * Muda o texto, não a ação: excluir a última encerra a assinatura no fim do
   * período vigente, e essa é a consequência que o cliente não adivinha pelo botão.
   */
  ultimaDoContrato: boolean
  excluindo: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Confirmação de exclusão de linha.
 *
 * Diálogo próprio, e não o `window.confirm` que a lista de agentes usa, por causa da
 * cobrança: excluir a última linha encerra o contrato, e isso é um parágrafo a mais
 * que o `confirm` do navegador não formata nem destaca.
 *
 * **A ação é irreversível e assíncrona.** O texto diz o que acontece — a linha some,
 * o número é desconectado, a cobrança muda — e não afirma que já aconteceu: a limpeza
 * no provider roda depois, na fila.
 */
export function ExcluirLinhaDialog({
  nome,
  ultimaDoContrato,
  excluindo,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/conexao-row')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('excluir.titulo')}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <p className="text-base font-semibold text-foreground">
          {t('excluir.titulo')}
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          {t('excluir.descricao', { nome })}
        </p>

        {/**
         * O aviso do contrato vem em destaque próprio: é a consequência que passa
         * despercebida, e a que envolve dinheiro.
         */}
        {ultimaDoContrato ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t('excluir.ultimaDoContrato')}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={excluindo}
            onClick={onCancel}
          >
            {t('excluir.cancelar')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={excluindo}
            onClick={onConfirm}
          >
            {excluindo ? (
              <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : null}
            {excluindo ? t('excluir.excluindo') : t('excluir.confirmar')}
          </Button>
        </div>
      </div>
    </div>
  )
}
