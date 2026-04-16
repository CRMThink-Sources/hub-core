import type Stripe from 'stripe'

/**
 * Faixas do preço. No Stripe, `tiers` só vem preenchido após `expand: ['tiers']` no retrieve.
 * Em preços multi-moeda, as faixas podem estar em `currency_options[currency].tiers`.
 */
export function getEffectiveTiers(price: Stripe.Price): Stripe.Price.Tier[] {
  if (price.tiers && price.tiers.length > 0) {
    return price.tiers
  }

  const code = price.currency?.toLowerCase?.() ?? ''
  if (!code || !price.currency_options) {
    return []
  }

  const perCurrency = price.currency_options[
    code as keyof typeof price.currency_options
  ] as { tiers?: Stripe.Price.Tier[] } | undefined

  const nested = perCurrency?.tiers
  if (Array.isArray(nested) && nested.length > 0) {
    return nested
  }

  return []
}

export type NormalizedTier = {
  /** Quantidade inicial da faixa (1-based). */
  fromQuantity: number
  /** Inclusivo; null = ilimitado. */
  toQuantity: number | null
  unitAmountCents: number
  flatAmountCents: number
}

export function normalizeTiers(price: Stripe.Price): NormalizedTier[] {
  const tiers = getEffectiveTiers(price)
  if (price.billing_scheme !== 'tiered' || tiers.length === 0) {
    return []
  }

  let lower = 1
  const out: NormalizedTier[] = []

  for (const tier of tiers) {
    const upper = tier.up_to
    out.push({
      fromQuantity: lower,
      toQuantity: upper,
      unitAmountCents: tier.unit_amount ?? 0,
      flatAmountCents: tier.flat_amount ?? 0,
    })
    if (upper === null) break
    lower = upper + 1
  }

  return out
}
