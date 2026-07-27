'use client'

import { useSession } from '@/providers/session-provider'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { resolveThinkzapClient } from '../../_lib/thinkzap-client'
import { useTranslation } from 'react-i18next'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'

export type ThinkzapPricingResponse = {
  currency: string
  billingScheme: string
  tiersMode: string | null
  tiers: Array<{
    fromQuantity: number
    toQuantity: number | null
    unitAmount: number
    flatAmount: number
  }>
  firstTierUnitAmount: number | null
}

type Props = {
  submitting: boolean
  quantidade: number
  quantidadeHub: number
  pricing: ThinkzapPricingResponse | null
  pricingLoading: boolean
  pricingErro: string | null
  linhasNaAssinatura: number
  totalAposContratar: number
  linhasNaEstimativa: number
  temAssinaturaAjustavel: boolean
  isTrial: boolean
  isCancelled: boolean
  onIncrement: () => void
  onDecrement: () => void
  onIncrementHub: () => void
  onDecrementHub: () => void
  onContinue: () => void
  onReactivateSubscription: () => void
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatFaixaTiers(fromQ: number, toQ: number | null): string {
  if (toQ === null) return `${fromQ}+`
  if (fromQ === toQ) return `${fromQ}`
  return `${fromQ}–${toQ}`
}

export function GestaoLinhasPricingCard({
  submitting,
  quantidade,
  quantidadeHub,
  pricing,
  pricingLoading,
  pricingErro,
  linhasNaAssinatura,
  totalAposContratar,
  linhasNaEstimativa,
  temAssinaturaAjustavel,
  isTrial,
  isCancelled,
  onIncrement,
  onDecrement,
  onIncrementHub,
  onDecrementHub,
  onContinue,
  onReactivateSubscription,
}: Props) {
  const { t } = useTranslation('thinkzap/gestao-linhas/pricing-card')
  const { session } = useSession()
  const [billingPortalUrl, setBillingPortalUrl] = useState<string | undefined>(
    undefined,
  )
  const hasSubscription = useMemo(
    () => session?.subscription !== null,
    [session?.subscription],
  )
  const totalEstimado = computeEstimateAmount(pricing, linhasNaEstimativa)

  useEffect(() => {
    const fetchBillingPortalUrl = async () => {
      try {
        const resolved = resolveThinkzapClient()
        if (!resolved.ok) {
          return
        }
        const response = await resolved.client.post<{
          url: string
        }>('/thinkzap/subscription/billing-portal')
        setBillingPortalUrl(response.url)
      } catch {
        setBillingPortalUrl(undefined)
      }
    }
    void fetchBillingPortalUrl()
  }, [])

  if (isTrial) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">
          {t('trial.titulo')}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('trial.info')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="mb-4 text-sm text-foreground">
        {isCancelled
          ? t('descricaoReativando', { count: quantidade })
          : t('descricaoAjustavel', {
              count: linhasNaAssinatura,
              atual: linhasNaAssinatura,
              total: totalAposContratar,
            })}
        {!isCancelled && t('proRata')}
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {temAssinaturaAjustavel && (
                <span className="min-w-[92px] text-xs font-medium text-muted-foreground">
                  {t('conector.naoOficial')}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={onDecrement}
                disabled={submitting}
              >
                <MinusIcon />
              </Button>
              <span className="min-w-[40px] text-center text-lg font-semibold text-foreground">
                {quantidade}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={onIncrement}
                disabled={submitting}
              >
                <PlusIcon />
              </Button>
            </div>

            {/* WhatsApp Oficial (HubMessage): só ao ajustar assinatura existente. */}
            {temAssinaturaAjustavel && (
              <div className="flex items-center gap-3">
                <span className="min-w-[92px] text-xs font-medium text-muted-foreground">
                  {t('conector.oficial')}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={onDecrementHub}
                  disabled={submitting}
                >
                  <MinusIcon />
                </Button>
                <span className="min-w-[40px] text-center text-lg font-semibold text-foreground">
                  {quantidadeHub}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={onIncrementHub}
                  disabled={submitting}
                >
                  <PlusIcon />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1 text-left">
            {pricing?.billingScheme === 'tiered' &&
              pricing.tiers.length > 0 && (
                <ul className="max-w-md space-y-0.5 text-xs text-muted-foreground">
                  {pricing.tiers.map((tier, index) => (
                    <li key={index}>
                      {t(
                        tier.toQuantity !== null &&
                          tier.toQuantity !== tier.fromQuantity
                          ? 'linhasPorTier_other'
                          : 'linhasPorTier_one',
                        {
                          faixa: formatFaixaTiers(
                            tier.fromQuantity,
                            tier.toQuantity,
                          ),
                          valor: formatCurrency(tier.unitAmount),
                        },
                      )}
                      {tier.flatAmount > 0 &&
                        t('fixo', { valor: formatCurrency(tier.flatAmount) })}
                    </li>
                  ))}
                </ul>
              )}

            {pricingErro && (
              <p className="text-xs text-amber-700">{pricingErro}</p>
            )}

            <p className="pt-1 text-sm text-muted-foreground">
              {isCancelled
                ? t('valorMensalReativar', { count: quantidade })
                : temAssinaturaAjustavel
                  ? t('valorMensalAjustavel', {
                      count: quantidade,
                      total: totalAposContratar,
                      atual: linhasNaAssinatura,
                      adicional: quantidade,
                    })
                  : t('valorMensalNovo', { count: quantidade })}
            </p>

            <p className="text-lg font-semibold text-primary">
              {pricingLoading ? (
                <span className="text-muted-foreground">…</span>
              ) : totalEstimado != null ? (
                <>R$ {formatCurrency(totalEstimado)}</>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isCancelled && (
            <Button
              type="button"
              onClick={onContinue}
              disabled={submitting || quantidade + quantidadeHub < 1}
            >
              {t('contratar', { count: quantidade + quantidadeHub })}
            </Button>
          )}

          {isCancelled && (
            <Button
              type="button"
              variant="secondary"
              onClick={onReactivateSubscription}
              disabled={submitting}
            >
              {t('reativarAssinatura')}
            </Button>
          )}

          {hasSubscription && (
            <Link
              href={billingPortalUrl ?? ''}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('alterarPagamento')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function computeEstimateAmount(
  pricing: ThinkzapPricingResponse | null,
  quantity: number,
): number | null {
  if (!pricing || quantity < 1) return null

  if (pricing.billingScheme === 'tiered' && pricing.tiers.length > 0) {
    if (pricing.tiersMode === 'volume') {
      const tier =
        pricing.tiers.find(
          t => t.toQuantity === null || quantity <= t.toQuantity,
        ) ?? pricing.tiers[pricing.tiers.length - 1]
      if (!tier) return null
      return quantity * tier.unitAmount + tier.flatAmount
    }

    let total = 0
    for (const tier of pricing.tiers) {
      const from = tier.fromQuantity
      const to = tier.toQuantity ?? Number.MAX_SAFE_INTEGER
      if (quantity < from) break

      const effectiveUpper = Math.min(quantity, to)
      const unitsInTier = effectiveUpper - from + 1
      if (unitsInTier > 0) {
        total += tier.flatAmount
        total += unitsInTier * tier.unitAmount
      }

      if (tier.toQuantity === null) break
    }

    return total
  }

  if (pricing.firstTierUnitAmount != null) {
    return quantity * pricing.firstTierUnitAmount
  }

  return null
}
