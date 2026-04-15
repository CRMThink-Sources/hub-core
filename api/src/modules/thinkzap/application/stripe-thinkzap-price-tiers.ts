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

/** Total em centavos para a quantidade de licenças (linhas) no ciclo, conforme o Price do Stripe. */
export function computeThinkzapLineTotalCents(
  quantity: number,
  price: Stripe.Price,
): number {
  const q = Math.max(0, Math.floor(quantity))
  if (q < 1) return 0

  if (price.billing_scheme === 'per_unit' && price.unit_amount != null) {
    return q * price.unit_amount
  }

  const tiers = getEffectiveTiers(price)
  if (price.billing_scheme === 'tiered' && tiers.length > 0) {
    const mode = price.tiers_mode ?? 'graduated'
    return mode === 'volume'
      ? volumeTierTotalCents(q, tiers)
      : graduatedTierTotalCents(q, tiers)
  }

  return 0
}

function graduatedTierTotalCents(
  q: number,
  tiers: Stripe.Price.Tier[],
): number {
  let total = 0
  let lowerBound = 1

  for (const tier of tiers) {
    const upperBound =
      tier.up_to === null ? Number.MAX_SAFE_INTEGER : tier.up_to
    if (q < lowerBound) break

    const effectiveUpper = Math.min(q, upperBound)
    const unitsInTier = effectiveUpper - lowerBound + 1
    if (unitsInTier > 0) {
      total += tier.flat_amount ?? 0
      total += unitsInTier * (tier.unit_amount ?? 0)
    }

    lowerBound = upperBound + 1
    if (tier.up_to === null) break
  }

  return total
}

function volumeTierTotalCents(q: number, tiers: Stripe.Price.Tier[]): number {
  for (const tier of tiers) {
    const upper = tier.up_to === null ? Number.POSITIVE_INFINITY : tier.up_to
    if (q <= upper) {
      return q * (tier.unit_amount ?? 0) + (tier.flat_amount ?? 0)
    }
  }

  const last = tiers[tiers.length - 1]
  if (!last) return 0
  return q * (last.unit_amount ?? 0) + (last.flat_amount ?? 0)
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
