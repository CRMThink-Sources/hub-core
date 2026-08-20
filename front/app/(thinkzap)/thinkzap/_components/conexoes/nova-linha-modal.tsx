'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type {
  LineProvider,
  OfferablePlan,
} from '@/app/hooks/use-line-subscription'
import { plansForProvider } from '@/app/hooks/use-line-subscription'

type Props = {
  isOpen: boolean
  /** Catálogo ofertável inteiro. O modal filtra por conector. */
  planos: OfferablePlan[]
  /** Conector em criação, para travar as duas opções sem congelar a tela. */
  criando: LineProvider | null
  onClose: () => void
  onCreate: (provider: LineProvider, planId: string) => void
}

/** Os dois conectores, na ordem em que a tela os oferece. */
const CONECTORES: LineProvider[] = ['ZAPI', 'HUBMESSAGE']

/**
 * Escolha do conector da linha nova.
 *
 * O conector é escolhido **no ato**, e não depois: é ele que define o preço e o que a
 * linha consegue fazer, e trocar depois de provisionado significaria jogar fora o
 * recurso no provider.
 *
 * A opção do conector sem plano ofertável **não aparece**. Mostrar e falhar depois da
 * escolha seria pior: o cliente já teria decidido, e o erro não diria que o problema é
 * configuração nossa.
 */
export function NovaLinhaModal({
  isOpen,
  planos,
  criando,
  onClose,
  onCreate,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/nova-linha')

  const disponiveis = CONECTORES.map(provider => ({
    provider,
    planos: plansForProvider(planos, provider),
  })).filter(opcao => opcao.planos.length > 0)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('titulo')}
    >
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lg">
        <p className="text-base font-semibold text-foreground">{t('titulo')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('descricao')}</p>

        {disponiveis.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-sm font-medium">{t('semPlanoTitulo')}</p>
            <p className="mt-1 text-sm">{t('semPlanoDescricao')}</p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {disponiveis.map(opcao => (
              <ConectorOpcao
                key={opcao.provider}
                provider={opcao.provider}
                planos={opcao.planos}
                disabled={criando !== null}
                loading={criando === opcao.provider}
                label={t(`conector.${opcao.provider}.titulo`)}
                hint={t(`conector.${opcao.provider}.descricao`)}
                escolherPlanoLabel={t('escolherPlano')}
                ctaLabel={t('criar')}
                ctaLoadingLabel={t('criando')}
                intervalLabel={interval => t(`intervalo.${interval}`)}
                onCreate={planId => onCreate(opcao.provider, planId)}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={criando !== null}
            onClick={onClose}
          >
            {t('cancelar')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConectorOpcao({
  provider,
  planos,
  label,
  hint,
  escolherPlanoLabel,
  ctaLabel,
  ctaLoadingLabel,
  intervalLabel,
  disabled,
  loading,
  onCreate,
}: {
  provider: LineProvider
  planos: OfferablePlan[]
  label: string
  hint: string
  escolherPlanoLabel: string
  ctaLabel: string
  ctaLoadingLabel: string
  intervalLabel: (interval: OfferablePlan['interval']) => string
  disabled: boolean
  loading: boolean
  onCreate: (planId: string) => void
}) {
  /** Só é escolha quando o conector tem mais de um plano ofertável. */
  const [escolhido, setEscolhido] = useState<string>(planos[0]?.id ?? '')
  const plano = planos.find(p => p.id === escolhido) ?? planos[0]

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>

      {planos.length > 1 ? (
        <select
          value={escolhido}
          onChange={e => setEscolhido(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          aria-label={escolherPlanoLabel}
        >
          {planos.map(opcao => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.name} · {formatAmount(opcao.amount)}
            </option>
          ))}
        </select>
      ) : null}

      {/* O valor é mostrado antes da confirmação: criar linha cobra. */}
      <p className="text-sm font-medium text-foreground">
        {formatAmount(plano.amount)}
        <span className="font-normal text-muted-foreground">
          /{intervalLabel(plano.interval)}
        </span>
      </p>

      <Button
        type="button"
        className="w-fit"
        disabled={disabled}
        onClick={() => onCreate(plano.id)}
        data-provider={provider}
        data-plan={plano.id}
      >
        {loading ? (
          <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : null}
        {loading ? ctaLoadingLabel : ctaLabel}
      </Button>
    </div>
  )
}

/** A api devolve centavos; a moeda é de apresentação, e o locale é o do operador. */
function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'BRL',
  })
}
