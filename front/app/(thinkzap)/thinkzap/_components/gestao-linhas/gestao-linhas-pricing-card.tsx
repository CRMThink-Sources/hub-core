'use client'

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
  erro: string | null
  submitting: boolean
  quantidade: number
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
  onContinue: () => void
  onConfirmTrial: () => void
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
  erro,
  submitting,
  quantidade,
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
  onContinue,
  onConfirmTrial,
  onReactivateSubscription,
}: Props) {
  const valorPrimeiraFaixa = pricing?.firstTierUnitAmount ?? null
  const totalEstimado = computeEstimateAmount(pricing, linhasNaEstimativa)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      {erro && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {erro}
        </p>
      )}

      <p className="mb-4 text-sm text-gray-700">
        {isCancelled
          ? `Você está reativando a assinatura com ${quantidade} linha${quantidade !== 1 ? 's' : ''}.`
          : `Sua assinatura atual possui ${linhasNaAssinatura} linha${linhasNaAssinatura !== 1 ? 's' : ''}. Após confirmar, ela passará para ${totalAposContratar} linha${totalAposContratar !== 1 ? 's' : ''}.`}
        {!isCancelled &&
          ' Ajustes podem gerar cobrança proporcional (pró-rata), conforme as regras da Stripe.'}
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onDecrement}
              disabled={submitting}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-gray-100 font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              −
            </button>
            <span className="min-w-[40px] text-center text-lg font-semibold text-black">
              {quantidade}
            </span>
            <button
              type="button"
              onClick={onIncrement}
              disabled={submitting}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-gray-100 font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              +
            </button>
          </div>

          <div className="space-y-1 text-left">
            {/* <p className="text-sm text-gray-600">
              {pricing?.billingScheme === 'tiered'
                ? '1ª faixa (por linha)'
                : 'Valor por linha'}
            </p> */}
            {/* <p className="text-lg font-semibold text-black">
              {pricingLoading ? (
                <span className="text-gray-400">Carregando…</span>
              ) : valorPrimeiraFaixa != null ? (
                <>R$ {formatCurrency(valorPrimeiraFaixa)}</>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </p> */}

            {pricing?.billingScheme === 'tiered' &&
              pricing.tiers.length > 0 && (
                <ul className="max-w-md space-y-0.5 text-xs text-gray-500">
                  {pricing.tiers.map((tier, index) => (
                    <li key={index}>
                      {formatFaixaTiers(tier.fromQuantity, tier.toQuantity)}{' '}
                      linha
                      {tier.toQuantity !== null &&
                      tier.toQuantity !== tier.fromQuantity
                        ? 's'
                        : ''}
                      : R$ {formatCurrency(tier.unitAmount)}/linha
                      {tier.flatAmount > 0 && (
                        <> + R$ {formatCurrency(tier.flatAmount)} fixo</>
                      )}
                    </li>
                  ))}
                </ul>
              )}

            {pricingErro && (
              <p className="text-xs text-amber-700">{pricingErro}</p>
            )}

            <p className="pt-1 text-sm text-gray-600">
              {isCancelled
                ? `Valor mensal para reativar com ${quantidade} linha${quantidade !== 1 ? 's' : ''}`
                : temAssinaturaAjustavel
                  ? `Valor mensal estimado com ${totalAposContratar} linha${totalAposContratar !== 1 ? 's' : ''} no total (${linhasNaAssinatura} + ${quantidade} adicional${quantidade !== 1 ? 'is' : ''})`
                  : `Valor mensal desta contratação (${quantidade} linha${quantidade !== 1 ? 's' : ''})`}
              {/* {pricing?.tiersMode && (
                <span className="mt-0.5 block text-[11px] text-gray-400">
                  Modo Stripe:{' '}
                  {pricing.tiersMode === 'graduated' ? 'graduado' : 'volume'}
                </span>
              )} */}
            </p>

            <p className="text-lg font-semibold text-[#5A997E]">
              {pricingLoading ? (
                <span className="text-gray-400">…</span>
              ) : totalEstimado != null ? (
                <>R$ {formatCurrency(totalEstimado)}</>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </p>
          </div>
        </div>

        {!isTrial && !isCancelled && (
          <button
            type="button"
            onClick={onContinue}
            disabled={submitting}
            className="cursor-pointer rounded-md bg-[#5A997E] px-5 py-2 text-sm font-medium text-white hover:bg-[#4a8169] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Contratar {quantidade} linha{quantidade !== 1 ? 's' : ''}
          </button>
        )}

        {(isTrial || isCancelled) && (
          <button
            type="button"
            onClick={isCancelled ? onReactivateSubscription : onConfirmTrial}
            disabled={submitting}
            className="cursor-pointer rounded-md bg-yellow-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelled ? 'Reativar assinatura' : 'Efetivar assinatura'}
          </button>
        )}
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
