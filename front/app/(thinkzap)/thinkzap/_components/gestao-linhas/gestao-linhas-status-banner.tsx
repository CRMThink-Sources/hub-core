'use client'

import Link from 'next/link'

type Props = {
  isTrial: boolean
  isCancelled: boolean
  hasSubscription: boolean
}

export function GestaoLinhasStatusBanner({
  isTrial,
  isCancelled,
  hasSubscription,
}: Props) {
  if (isTrial) {
    return null
  }

  if (!hasSubscription) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <p>
            Você não possui uma assinatura. Ative o seu trial de 7 dias para{' '}
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
