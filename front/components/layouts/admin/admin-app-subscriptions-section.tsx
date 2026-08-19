'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosPortal } from '@/infra/client/axios-portal'
import type {
  AppSubscription,
  ListAppSubscriptionsResponse,
} from '@/lib/portal-domains'

/**
 * `no-mirror` é estado próprio, não lista vazia: instalação sem espelho na SPA 1060 não
 * tem o que consultar (o filtro da 1142 é pelo campo parent), e chamar isso de "sem
 * assinatura" mandaria o suporte procurar contrato onde nem existe vínculo.
 *
 * `error` também é próprio: a aba só existe para mostrar contrato, então falha de
 * leitura não tem outro conteúdo para degradar — e mostrar vazio afirmaria que o cliente
 * não paga nada.
 */
type SectionState =
  | { kind: 'loading' }
  | { kind: 'ready'; subscriptions: AppSubscription[] }
  | { kind: 'no-mirror' }
  | { kind: 'error' }

type Props = {
  appId: string
}

/** Aba Assinaturas: leitura das SPAs 1142/1146, sem nenhuma ação de escrita. */
export function AdminAppSubscriptionsSection({ appId }: Props) {
  const { t, i18n } = useTranslation('admin/app-settings')
  const locale = i18n.language
  const [state, setState] = useState<SectionState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ kind: 'loading' })
      try {
        const output = await axiosPortal().get<ListAppSubscriptionsResponse>(
          `/portal/apps/${appId}/subscriptions`,
        )
        if (cancelled) return
        setState(
          output.mirrored
            ? { kind: 'ready', subscriptions: output.subscriptions }
            : { kind: 'no-mirror' },
        )
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [appId])

  function formatDate(iso: string) {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(locale)
  }

  if (state.kind === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('subscriptionsLoading')}
      </p>
    )
  }

  if (state.kind === 'error') {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {t('subscriptionsError')}
      </p>
    )
  }

  if (state.kind === 'no-mirror') {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        {t('subscriptionsNoMirror')}
      </p>
    )
  }

  if (state.subscriptions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('subscriptionsEmpty')}</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">
              {t('subscriptionsColumnStatus')}
            </th>
            <th className="px-4 py-3 font-medium">
              {t('subscriptionsColumnModality')}
            </th>
            <th className="px-4 py-3 font-medium">
              {t('subscriptionsColumnPlan')}
            </th>
            <th className="px-4 py-3 font-medium">
              {t('subscriptionsColumnPeriodEnd')}
            </th>
            <th className="px-4 py-3 font-medium">
              {t('subscriptionsColumnLines')}
            </th>
            <th className="px-4 py-3 font-medium">
              {t('subscriptionsColumnGatewayId')}
            </th>
          </tr>
        </thead>
        <tbody>
          {state.subscriptions.map(subscription => (
            <tr
              key={subscription.id}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-4 py-3 text-foreground">
                {subscription.status}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {subscription.modality}
              </td>
              <td className="px-4 py-3 text-foreground">
                {subscription.planName}
                <span className="block text-xs text-muted-foreground">
                  {subscription.productName}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(subscription.currentPeriodEnd)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {/* Item `NONE` é cobrança sem linha, e a api já não o conta. */}
                {
                  subscription.items.filter(
                    item => item.metadata.provider !== 'NONE',
                  ).length
                }
              </td>
              {/* Texto simples: id de gateway não é link nem ação nesta tela. */}
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {subscription.gatewayId ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
