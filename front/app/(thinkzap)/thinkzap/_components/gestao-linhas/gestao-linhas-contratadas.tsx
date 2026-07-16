'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type Connector = {
  id: string
  instance: {
    name?: string | null
    phoneNumber?: string | null
    paidStatus?: string | null
    connected?: boolean | null
  }
}

type Props = {
  connectors: Connector[]
  totalLinhas: number
  isTrial: boolean
  submitting: boolean
  onConfirmTrial: () => void
}

function formatPhoneNumber(phone: string) {
  if (!phone) return '-'
  const match = phone.match(/^\+(\d{2})(\d{2})(\d{5})(\d{4})$/)
  if (!match) return phone
  return `+${match[1]} ${match[2]} ${match[3]}-${match[4]}`
}

function getConnectionStatus(
  connected: boolean | null | undefined,
  t: (key: string) => string,
) {
  return connected
    ? {
        className: 'bg-primary/10 text-primary',
        text: t('status.ativo'),
      }
    : {
        className: 'bg-destructive/10 text-destructive',
        text: t('status.inativo'),
      }
}

export function GestaoLinhasContratadas({
  connectors,
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
                <th className="min-w-40 px-3 py-2">{t('colunas.telefone')}</th>
                <th className="px-3 py-2">{t('colunas.nomeCanal')}</th>
                <th className="px-3 py-2 min-w-40">{t('colunas.conexao')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {connectors.map(conn => {
                const status = getConnectionStatus(conn.instance.connected, t)
                const showEfetivar =
                  isTrial && conn.instance.paidStatus === 'TRIAL'
                return (
                  <tr key={conn.id}>
                    <td className="px-3 py-2">
                      {formatPhoneNumber(conn.instance.phoneNumber ?? '')}
                    </td>
                    <td className="px-3 py-2">
                      {conn.instance.name || t('semNome')}
                    </td>
                    <td className="flex items-center justify-between px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${status.className}`}
                      >
                        {status.text}
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
          {/* <div
            className={`grid items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 ${gridClass}`}
          >
            <p className="text-xs font-semibold uppercase text-gray-600">
              Telefone
            </p>
            <p className="text-xs font-semibold uppercase text-gray-600 sm:min-w-0">
              Nome do canal
            </p>
            <p className="text-start text-xs font-semibold uppercase text-gray-600 sm:text-end">
              Conexão
            </p>
          </div> */}

          {/* {connectors.map(conn => {
            const status = getConnectionStatus(conn.instance.paidStatus)
            const showEfetivar = isTrial && conn.instance.paidStatus === 'TRIAL'

            return (
              <div
                key={conn.id}
                className={`grid items-center gap-4 rounded-lg border border-gray-100 bg-white p-3 transition-colors hover:border-gray-200 ${gridClass}`}
              >
                <p className="text-sm font-medium text-black">
                  {formatPhoneNumber(conn.instance.phoneNumber ?? '')}
                </p>
                <p className="min-w-0 break-all text-sm font-semibold text-black sm:wrap-break-word">
                  {conn.instance.name || 'Sem nome'}
                </p>
                <div className="flex flex-wrap items-center justify-start gap-2 sm:min-w-0 sm:justify-end sm:gap-2.5">
                  <span
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
                    style={{
                      color: status.textColor,
                      backgroundColor: status.bgColor,
                    }}
                  >
                    {status.text}
                  </span>
                  {showEfetivar ? (
                    <button
                      type="button"
                      onClick={onConfirmTrial}
                      disabled={submitting}
                      className="shrink-0 cursor-pointer rounded-md bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Efetivar assinatura
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })} */}
        </div>
      </div>

      <h3 className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
        {t('totalLinhas', { total: totalLinhas })}
      </h3>
    </>
  )
}
