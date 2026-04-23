'use client'

import Link from 'next/link'

type Props = {
  hasSubscription: boolean
  subscriptionStatus?: string
}

export function ConexoesHeaderCard({
  hasSubscription,
  subscriptionStatus,
}: Props) {
  const isCancelled = subscriptionStatus === 'CANCELLED'

  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-fit">
        <h1 className="page-title">Configurações</h1>
        <h2 className="page-subtitle mt-1">
          Gerencie os números de WhatsApp conectados ao Bitrix24
        </h2>
      </div>

      <div className="flex w-full flex-wrap justify-end gap-2">
        {!hasSubscription && (
          <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
            <Link
              className="inline-flex w-full items-center justify-center rounded-lg bg-yellow-500 px-5 py-2.5 text-center font-medium text-white transition-colors hover:bg-yellow-600 sm:w-auto"
              href="/thinkzap/financeiro"
            >
              + Ativar trial
            </Link>
          </div>
        )}

        {hasSubscription && (
          <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
            <Link
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#5A997E] px-5 py-2.5 text-center font-medium text-white transition-colors hover:bg-[#4a8169] sm:w-auto"
              href="/thinkzap/financeiro"
            >
              {isCancelled ? 'Reativar assinatura' : '+ Contratar linha'}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
