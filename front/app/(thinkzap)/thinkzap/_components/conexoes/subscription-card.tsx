'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { UseLineSubscription } from '@/app/hooks/use-line-subscription'
import { needsSubscription } from '@/app/hooks/use-line-subscription'

/**
 * O contrato vigente da instalação.
 *
 * **Não oferece plano.** A contratação mora na linha da tabela, porque o que se
 * assina é a linha: com mais de uma na lista, um botão aqui não diria qual. Este
 * card fala do que já está contratado — valor, ciclo, status e modalidade — e da
 * ação que é da assinatura inteira, não de uma linha: o portal de faturamento.
 *
 * A modalidade é mostrada de propósito: o cliente de boleto que não vê onde trocar
 * o cartão precisa saber que não é por falta da tela.
 *
 * Recebe o estado por prop em vez de buscar: a tabela consome o mesmo dado, e duas
 * buscas seriam duas requisições capazes de discordar.
 */
export function SubscriptionCard({
  subscription: hook,
}: {
  subscription: UseLineSubscription
}) {
  const { t } = useTranslation('thinkzap/conexoes/subscription')
  const { state, redirecting, openBillingPortal } = hook

  if (state.kind === 'loading') return null

  if (state.kind === 'error') {
    return (
      <Shell tone="amber">
        <p className="text-sm font-medium">{t('erroLeituraTitulo')}</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </Shell>
    )
  }

  const { subscription, mixedProviders, processing } = state

  /**
   * Pagou e o webhook ainda não chegou. Vem **antes** de qualquer outro estado, de
   * propósito: o estado real neste instante ainda é o antigo, e mostrá-lo diria
   * "bloqueado" a quem acabou de pagar.
   */
  if (processing) {
    return (
      <Shell tone="blue">
        <div className="flex items-center gap-3">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
          <p className="text-sm font-medium">{t('processandoTitulo')}</p>
        </div>
        <p className="mt-1 text-sm">{t('processandoDescricao')}</p>
      </Shell>
    )
  }

  /**
   * Conectores misturados e sem plano possível: a tela **tem** que dizer isso. É o
   * único caminho em que a ausência de oferta não significa "falta cadastrar plano",
   * e calar deixaria o cliente esperando por uma oferta que nunca vai aparecer.
   */
  if (mixedProviders && needsSubscription(subscription)) {
    return (
      <Shell tone="amber">
        <p className="text-sm font-medium">{t('conectoresMistosTitulo')}</p>
        <p className="mt-1 text-sm">{t('conectoresMistosDescricao')}</p>
      </Shell>
    )
  }

  /**
   * O contrato **pago** vigente, ou nada a mostrar. Instalação que só tem trial não
   * rende card: quem fala do teste é o `TrialCard`.
   */
  if (subscription.status === 'none' || subscription.isTrial) return null

  const contract = subscription

  return (
    <Shell tone={contract.entitlement !== 'active' ? 'amber' : 'neutral'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-foreground">
            {contract.plan.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('valorPorIntervalo', {
              valor: formatAmount(contract.plan.amount),
              intervalo: t(`intervalo.${contract.plan.interval}`),
            })}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            status={contract.status}
            label={t(`status.${contract.status}`)}
          />
          {/* A modalidade é rótulo, não ação: diz de onde a cobrança vem. */}
          <span className="text-xs text-muted-foreground">
            {t(`modalidade.${contract.modality}`)}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm">
        {contract.status === 'cancelled'
          ? t('canceladaDescricao', {
              data: formatDate(contract.currentPeriodEnd),
            })
          : contract.status === 'past_due'
            ? t('inadimplenteDescricao')
            : t('vigenteDescricao', {
                data: formatDate(contract.currentPeriodEnd),
              })}
      </p>

      {/**
       * O portal só aparece para assinatura do gateway. `billingPortalAvailable` vem
       * do servidor de propósito: a regra de quando ele existe é a mesma que a rota
       * usa para recusar, e duplicá-la aqui deixaria as duas divergirem.
       */}
      {contract.billingPortalAvailable ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={redirecting !== null}
            onClick={() => void openBillingPortal()}
          >
            {redirecting === 'portal'
              ? t('abrindoPortal')
              : t('gerenciarPagamento')}
          </Button>
        </div>
      ) : null}

      {/**
       * Boleto é mantido por fora: nada aqui oferece portal, checkout nem
       * cancelamento para essa modalidade. O aviso substitui a ação que não existe,
       * para o cliente não procurar onde trocar o cartão.
       */}
      {contract.modality === 'manual' ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('manualSemAutoatendimento')}
        </p>
      ) : null}
    </Shell>
  )
}

const STATUS_TONES = {
  active: 'bg-emerald-100 text-emerald-800',
  past_due: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  trialing: 'bg-blue-100 text-blue-800',
} as const

function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof STATUS_TONES
  label: string
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONES[status]}`}
      data-status={status}
    >
      {label}
    </span>
  )
}

const TONES = {
  neutral: 'border-border bg-card',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
} as const

function Shell({
  tone,
  children,
}: {
  tone: keyof typeof TONES
  children: React.ReactNode
}) {
  return (
    <div className={`w-full rounded-xl border p-6 ${TONES[tone]}`}>
      {children}
    </div>
  )
}

/**
 * A api devolve centavos, como o `unit_amount` do gateway. A conversão fica aqui
 * porque a moeda é de apresentação — o servidor não conhece o locale do operador.
 */
function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'BRL',
  })
}

/** Data crua da api: fuso e formatação são da tela. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}
