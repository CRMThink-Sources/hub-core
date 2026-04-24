'use client'

import Link from 'next/link'

type Props = {
  isTrial: boolean
  isCancelled: boolean
  hasSubscription: boolean
  submitting: boolean
  onActivateTrial: () => void
  onConfirmTrial: () => void
}

export function GestaoLinhasStatusBanner({
  isTrial,
  isCancelled,
  hasSubscription,
  submitting,
  onActivateTrial,
  onConfirmTrial,
}: Props) {
  if (isTrial) {
    return (
      <div className="flex items-center justify-between">
        <p>
          Voce esta em periodo de trial. Caso queira contratar mais linhas,
          efetive a assinatura.
        </p>
        <button
          type="button"
          onClick={onConfirmTrial}
          disabled={submitting}
          className="cursor-pointer rounded-md bg-yellow-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Efetivar assinatura
        </button>
      </div>
    )
  }

  if (!hasSubscription) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <p>
            Voce não possui uma assinatura. Ative o seu trial de 7 dias para
            testar o ThinkZap.
          </p>
          <Link
            href="/thinkzap/ativar-trial"
            className="cursor-pointer rounded-md bg-yellow-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Ativar trial
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Após o trial, você pode contratar mais linhas.
        </p>
      </div>
    )
  }

  if (isCancelled) {
    return (
      <div>
        <p>
          Sua assinatura está cancelada. Escolha a quantidade de linhas abaixo e
          reative pelo card de valores.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-black">
        Contratar novas linhas
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Aumente sua capacidade contratando mais linhas.
      </p>
    </div>
  )
}
