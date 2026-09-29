'use client'

import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Props = {
  /**
   * Nome exibido na saudação — nome+sobrenome do usuário Bitrix logado quando o
   * BX24 resolve, com fallback para o nome do cliente/domínio (`customer.name`)
   * quando o app roda fora do iframe do Bitrix ou a chamada falha.
   */
  greetingName: string
}

/**
 * Banner de boas-vindas no topo da home. Decorativo — usa `text-primary` e
 * `bg-primary`, que variam por instalação (cada cliente tem sua cor de marca via
 * CSS custom properties), então funciona em qualquer tema sem hardcode de cor.
 */
export function HomeHero({ greetingName }: Props) {
  const { t } = useTranslation('thinkzap/home')

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 sm:p-8">
      <MessageCircle
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 size-40 text-primary/10"
      />
      <div className="relative">
        <p className="text-sm font-medium text-primary">ThinkZap</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('hero.greeting', { name: greetingName })}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {t('hero.subtitle')}
        </p>
      </div>
    </div>
  )
}
