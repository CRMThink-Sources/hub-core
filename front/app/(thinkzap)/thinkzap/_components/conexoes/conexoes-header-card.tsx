'use client'

import { useTranslation } from 'react-i18next'

/**
 * Cabeçalho da tela de conexões.
 *
 * Os botões de ativar trial, contratar linha e reativar assinatura saíram com a
 * cobrança antiga: apontavam para `/thinkzap/financeiro`, que não existe mais.
 *
 * As props de assinatura continuam na interface, ignoradas: a tela de conexões
 * ainda as recebe do estado da sessão, e o cabeçalho é onde a ação de cobrança
 * volta a morar. Removê-las agora só faria o chamador ser reescrito duas vezes.
 */
type Props = {
  hasSubscription: boolean
  subscriptionStatus?: string
}

export function ConexoesHeaderCard(_props: Props) {
  const { t } = useTranslation('thinkzap/conexoes/header-card')

  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-fit">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <h2 className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</h2>
      </div>
    </div>
  )
}
