'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPortalDate } from '@/lib/format-date'
import { capitalizeFirst } from '../../_lib/send-format'
import type { SendListItem } from '../../_lib/thinkzap-sends-client'
import { senderDisplay } from './envios-view'
import { SendStatusBadge } from './send-status-badge'

/** Remetente como texto: nome, "Automação" (robô sem usuário) ou neutro. */
export function SenderLabel({ sender }: { sender: SendListItem['sender'] }) {
  const { t } = useTranslation('thinkzap/envios')
  const display = senderDisplay(sender)
  if (display.kind === 'name') return <>{display.name}</>
  if (display.kind === 'automation') return <>{t('sender.automation')}</>
  return (
    <span title={t('sender.unknown')}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t('sender.unknown')}</span>
    </span>
  )
}

/** Aviso de conferência: alguma parte saiu sem confirmação do provedor. */
export function UnconfirmedWarning() {
  const { t } = useTranslation('thinkzap/envios')
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-amber-800 dark:text-amber-400">
      <AlertTriangleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{t('unconfirmedWarning')}</span>
    </p>
  )
}

type Props = {
  items: SendListItem[]
  locale: string
  onOpen: (id: string) => void
}

/**
 * Tabela dos envios. Nomes, motivos e telefones entram só como nós de texto
 * do React (escapados): vêm do Bitrix e do provedor, não são confiáveis.
 * A linha inteira abre o detalhe com o mouse; pelo teclado, o botão
 * "Detalhes" de cada linha (a linha não é um controle de verdade).
 */
export function SendsTable({ items, locale, onOpen }: Props) {
  const { t } = useTranslation('thinkzap/envios')

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">{t('table.caption')}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-medium">
              {t('table.createdAt')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('table.line')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('table.destination')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('table.kind')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('table.origin')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('table.sender')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('table.status')}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              <span className="sr-only">{t('table.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.id}
              onClick={() => onOpen(item.id)}
              className="cursor-pointer border-b border-border align-top last:border-b-0 hover:bg-muted/30"
            >
              <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground tabular-nums">
                {formatPortalDate(item.createdAt, locale)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.line.name}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-foreground tabular-nums">
                {item.destination}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {t(`kind.${item.kind}`, { defaultValue: item.kind })}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {t(`origin.${item.origin}`, { defaultValue: item.origin })}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <SenderLabel sender={item.sender} />
              </td>
              <td className="max-w-xs px-4 py-3">
                <SendStatusBadge status={item.status} />
                {item.failureReason && (
                  <p className="mt-1 text-xs break-words text-red-700 dark:text-red-400">
                    {capitalizeFirst(item.failureReason)}
                  </p>
                )}
                {item.hasUnconfirmed && <UnconfirmedWarning />}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t('table.openAria', {
                    destination: item.destination,
                  })}
                  onClick={event => {
                    event.stopPropagation()
                    onOpen(item.id)
                  }}
                >
                  {t('table.open')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
