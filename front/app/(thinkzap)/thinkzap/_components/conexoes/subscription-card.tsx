'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type {
  ContractPlan,
  UseLineSubscription,
} from '@/app/hooks/use-line-subscription'
import { resolveContractCardShape } from './contract-card-shape'

/**
 * O contrato vigente da instalação.
 *
 * **Não oferece plano.** A contratação mora na linha da tabela, porque o que se
 * assina é a linha: com mais de uma na lista, um botão aqui não diria qual. Este
 * card fala do que já está contratado e da ação que é da assinatura inteira, não de
 * uma linha: o portal de faturamento.
 *
 * **Duas formas** (`resolveContractCardShape`). A completa detalha cobrança — valor,
 * composição, portal — e existe só para assinatura do gateway cuja cobrança foi lida
 * lá. A reduzida mostra período vigente e modalidade, e é o que sobra quando a
 * aplicação não conhece a cobrança: boleto, mantido por automação de fora, e a
 * leitura do gateway que não veio.
 *
 * A modalidade aparece nas duas: o cliente de boleto que não vê onde trocar o cartão
 * precisa saber que não é por falta da tela.
 *
 * **Nenhum valor é calculado aqui.** Preço de conector é escalonado no gateway, e a
 * soma local de `amount × lineCount` foi exatamente o que passou a anunciar mais do
 * que a fatura cobra. O servidor manda `chargedAmount` e `contractTotal` prontos.
 *
 * Recebe o estado por prop em vez de buscar: a tabela consome o mesmo dado, e duas
 * buscas seriam duas requisições capazes de discordar.
 */
export function SubscriptionCard({
  subscription: hook,
}: {
  subscription: UseLineSubscription
}) {
  const { t } = useTranslation('thinkzap/conexoes/subscription')
  const { state, redirecting, openBillingPortal } = hook

  if (state.kind === 'loading') return null

  if (state.kind === 'error') {
    return (
      <Shell tone="amber">
        <p className="text-sm font-medium">{t('erroLeituraTitulo')}</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </Shell>
    )
  }

  const { subscription, processing } = state

  /**
   * Pagou e o webhook ainda não chegou. Vem **antes** de qualquer outro estado, de
   * propósito: o estado real neste instante ainda é o antigo, e mostrá-lo diria
   * "bloqueado" a quem acabou de pagar.
   */
  if (processing) {
    return (
      <Shell tone="blue">
        <div className="flex items-center gap-3">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
          <p className="text-sm font-medium">{t('processandoTitulo')}</p>
        </div>
        <p className="mt-1 text-sm">{t('processandoDescricao')}</p>
      </Shell>
    )
  }

  const shape = resolveContractCardShape(subscription)

  /**
   * Instalação sem contrato pago a comentar. Quem fala do teste é o `TrialCard`, e
   * dois cards sobre o mesmo estado se contradiriam.
   */
  if (shape.kind === 'ausente') return null

  const contract = shape.contract
  const planos = shape.kind === 'completa' ? shape.plans : []

  /**
   * O total vem pronto do servidor. `null` é "algum plano ficou sem preço": aí o card
   * cala em vez de mostrar um total parcial passando por completo.
   */
  const total = contract.contractTotal
  const intervalo = planos[0]?.interval

  return (
    <Shell tone={contract.entitlement !== 'active' ? 'amber' : 'neutral'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-foreground">
            {t('tituloContrato')}
          </p>
          {/* Sem composição não há valor a afirmar: o card fala só do status. */}
          {intervalo && total != null ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('valorPorIntervalo', {
                valor: formatAmount(total),
                intervalo: t(`intervalo.${intervalo}`),
              })}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            status={contract.status}
            label={t(`status.${contract.status}`)}
          />
          {/* A modalidade é rótulo, não ação: diz de onde a cobrança vem. */}
          <span className="text-xs text-muted-foreground">
            {t(`modalidade.${contract.modality}`)}
          </span>
        </div>
      </div>

      {/**
       * A composição, sempre que existir — inclusive com um plano só. Ela é o que
       * torna a soma acima verificável pelo cliente: sem ela, um contrato de duas
       * linhas mostraria um valor que não bate com nenhum plano do catálogo.
       */}
      {planos.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
          {planos.map(plano => (
            <ComposicaoItem
              key={plano.id}
              plano={plano}
              /**
               * Duas chaves em vez do plural do i18next: nenhuma mensagem do projeto usa
               * `count` hoje, e um plural que não resolve some do texto em silêncio.
               */
              linhasLabel={
                plano.lineCount === 1
                  ? t('umaLinha')
                  : t('variasLinhas', { quantidade: plano.lineCount })
              }
              /**
               * Só quando há bonificada: contrato em paridade não menciona a palavra.
               * "2 cobradas · 0 bonificadas" seria ruído em cima do caso comum.
               */
              detalheLabel={
                (plano.compedCount ?? 0) > 0
                  ? t('cobradasEBonificadas', {
                      cobradas: plano.billedCount ?? 0,
                      bonificadas: plano.compedCount ?? 0,
                    })
                  : null
              }
            />
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-sm">
        {contract.status === 'cancelled'
          ? t('canceladaDescricao', {
              data: formatDate(contract.currentPeriodEnd),
            })
          : contract.status === 'past_due'
            ? t('inadimplenteDescricao')
            : t('vigenteDescricao', {
                data: formatDate(contract.currentPeriodEnd),
              })}
      </p>

      {/**
       * O portal só aparece para assinatura do gateway. `billingPortalAvailable` vem
       * do servidor de propósito: a regra de quando ele existe é a mesma que a rota
       * usa para recusar, e duplicá-la aqui deixaria as duas divergirem.
       */}
      {shape.kind === 'completa' && contract.billingPortalAvailable ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={redirecting !== null}
            onClick={() => void openBillingPortal()}
          >
            {redirecting === 'portal'
              ? t('abrindoPortal')
              : t('gerenciarPagamento')}
          </Button>
        </div>
      ) : null}
    </Shell>
  )
}

/**
 * Um plano do contrato: o que ele custa e quantas linhas ele cobra.
 *
 * O valor vem de `chargedAmount`, calculado no servidor sobre as linhas **cobradas**.
 * `null` é "não sabemos o preço": a linha do plano aparece sem valor, e não com
 * `R$ 0,00` — zero afirmaria gratuidade onde há desconhecimento.
 *
 * Plano inteiramente bonificado é caso diferente: ali `chargedAmount` é zero de
 * verdade, e o zero é a informação.
 */
function ComposicaoItem({
  plano,
  linhasLabel,
  detalheLabel,
}: {
  plano: ContractPlan
  linhasLabel: string
  /** "2 cobradas · 1 bonificada", ou `null` quando não há bonificada. */
  detalheLabel: string | null
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-foreground">
        {plano.name}
        <span className="ml-2 text-muted-foreground">{linhasLabel}</span>
        {detalheLabel ? (
          <span className="block text-xs text-muted-foreground">
            {detalheLabel}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {plano.chargedAmount == null ? '—' : formatAmount(plano.chargedAmount)}
      </span>
    </li>
  )
}

const STATUS_TONES = {
  active: 'bg-emerald-100 text-emerald-800',
  past_due: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  trialing: 'bg-blue-100 text-blue-800',
} as const

function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof STATUS_TONES
  label: string
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONES[status]}`}
      data-status={status}
    >
      {label}
    </span>
  )
}

const TONES = {
  neutral: 'border-border bg-card',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
} as const

function Shell({
  tone,
  children,
}: {
  tone: keyof typeof TONES
  children: React.ReactNode
}) {
  return (
    <div className={`w-full rounded-xl border p-6 ${TONES[tone]}`}>
      {children}
    </div>
  )
}

/**
 * A api devolve centavos, como o `unit_amount` do gateway. A conversão fica aqui
 * porque a moeda é de apresentação — o servidor não conhece o locale do operador.
 */
function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'BRL',
  })
}

/** Data crua da api: fuso e formatação são da tela. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}
