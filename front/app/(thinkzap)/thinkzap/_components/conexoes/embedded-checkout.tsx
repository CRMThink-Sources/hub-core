'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadStripe } from '@stripe/stripe-js'
import type { Stripe, StripeEmbeddedCheckout } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { envConfig } from '@/shared/infra/env-config'

/**
 * `loadStripe` fora do componente: ele injeta o script do gateway na página e
 * memoiza. Chamado a cada render, recarregaria o SDK a cada montagem do checkout.
 *
 * `null` quando a publishable key não está configurada — a tela reporta em vez de
 * tentar montar e falhar dentro do SDK.
 */
const stripePromise: Promise<Stripe | null> | null =
  envConfig.stripePublishableKey
    ? loadStripe(envConfig.stripePublishableKey)
    : null

type Props = {
  /** `client_secret` da sessão embedada, vindo do servidor. */
  clientSecret: string
  /** Fechou sem pagar — botão da nossa tela. */
  onClose: () => void
  /**
   * Pagou. Vem do `onComplete` do SDK, não de navegação: a sessão é criada com
   * redirecionamento desligado justamente para nada navegar dentro do iframe.
   */
  onComplete: () => void
}

/**
 * Checkout do gateway montado **dentro** da tela.
 *
 * O app roda no iframe do Bitrix, e a página hospedada do gateway não funciona
 * emoldurada: em contexto de terceiro o navegador particiona o storage que ela
 * precisa, e ela trava nos placeholders sem montar o formulário. O modo embedado é o
 * caminho suportado — o SDK cria o próprio frame, na origem do gateway, desenhado
 * para viver dentro de outra página.
 *
 * Desmontar é obrigatório: o SDK deixa o frame na página se ninguém chamar
 * `destroy`, e uma segunda montagem sobre um resíduo falha em silêncio.
 */
export function EmbeddedCheckout({ clientSecret, onClose, onComplete }: Props) {
  const { t } = useTranslation('thinkzap/conexoes/subscription')
  const containerRef = useRef<HTMLDivElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  /**
   * `onComplete` numa ref: se entrasse nas dependências do efeito, cada render do pai
   * recriaria a instância do checkout — desmontando o formulário enquanto o cliente
   * digita o cartão.
   */
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!stripePromise) {
      setErro(t('checkoutSemChave'))
      return
    }

    let instancia: StripeEmbeddedCheckout | null = null
    /**
     * O `await` abaixo pode resolver depois de o componente sair da tela. Sem esta
     * guarda o SDK montaria num container que não existe mais.
     */
    let cancelado = false

    void (async () => {
      try {
        const stripe = await stripePromise
        if (!stripe) throw new Error('SDK do gateway não carregou')
        if (cancelado || !containerRef.current) return

        const checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret,
          onComplete: () => onCompleteRef.current(),
        })
        instancia = checkout

        if (cancelado || !containerRef.current) {
          checkout.destroy()
          return
        }

        checkout.mount(containerRef.current)
      } catch (err: unknown) {
        if (!cancelado) {
          setErro(err instanceof Error ? err.message : t('erroCheckout'))
        }
      }
    })()

    /**
     * `destroy` é obrigatório: sem ele o frame do gateway fica na página, e uma
     * segunda montagem sobre o resíduo falha em silêncio.
     */
    return () => {
      cancelado = true
      instancia?.destroy()
    }
  }, [clientSecret, t])

  return (
    <div className="w-full rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-foreground">
            {t('checkoutTitulo')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('checkoutDescricao')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t('checkoutFechar')}
        </Button>
      </div>

      {erro ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">{t('checkoutErroTitulo')}</p>
          <p className="mt-1 text-sm">{erro}</p>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-[28rem] w-full" />
      )}
    </div>
  )
}
