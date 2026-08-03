'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { SubscriptionLine } from '@/shared/aplication/subscription-items'

type Props = {
  linhas: SubscriptionLine[]
  totalLinhas: number
  isTrial: boolean
  submitting: boolean
  onConfirmTrial: () => void
}

/**
 * Linhas contratadas — itens de assinatura de `GET /api/application/me`.
 *
 * Sem conector/instância, as colunas de telefone e de status de conexão saíram:
 * nenhum dos dois vive no item. O status exibido é o do item (cobrança). O botão
 * de efetivar assinatura passa a depender do status da assinatura (`isTrial`),
 * não do `paidStatus` da instância.
 */
export function GestaoLinhasContratadas({
  linhas,
  totalLinhas,
  isTrial,
  submitting,
  onConfirmTrial,
}: Props) {
  const { t } = useTranslation('thinkzap/gestao-linhas/contratadas')

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t('titulo')}
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          <table>
            <thead className="bg-muted text-left">
              <tr className="text-xs font-semibold uppercase text-muted-foreground h-10">
                <th className="min-w-40 px-3 py-2">{t('colunas.linha')}</th>
                <th className="px-3 py-2">{t('colunas.provider')}</th>
                <th className="px-3 py-2">{t('colunas.plano')}</th>
                <th className="px-3 py-2 min-w-40">{t('colunas.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map(linha => {
                const isAtiva = linha.status === 'active'
                const statusClass = isAtiva
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/10 text-destructive'
                const statusText = isAtiva
                  ? t('status.ativo')
                  : t('status.cancelado')
                const providerText =
                  linha.provider === 'HUBMESSAGE'
                    ? t('provider.oficial')
                    : linha.provider === 'ZAPI'
                      ? t('provider.naoOficial')
                      : '—'
                // No trial, a linha ativa é a que pode ser efetivada.
                const showEfetivar = isTrial && isAtiva

                return (
                  <tr key={linha.id}>
                    <td className="px-3 py-2">{linha.name || t('semNome')}</td>
                    <td className="px-3 py-2">{providerText}</td>
                    <td className="px-3 py-2">{linha.planName || '—'}</td>
                    <td className="flex items-center justify-between px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${statusClass}`}
                      >
                        {statusText}
                      </span>
                      {showEfetivar ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={onConfirmTrial}
                          disabled={submitting}
                          className="shrink-0"
                        >
                          {t('efetivarAssinatura')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
        {t('totalLinhas', { total: totalLinhas })}
      </h3>
    </>
  )
}
