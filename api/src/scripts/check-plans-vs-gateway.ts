import 'dotenv/config'

import Stripe from 'stripe'
import { env } from '@/config/env'
import { Plan } from '@/modules/application/domain/entities/plan'
import { planGatewayIdField } from '@/modules/application/infra/bitrix/ensure-plan-gateway-id-fields'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixPlanRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-plans.repository'
import { BitrixProductRepository } from '@/modules/application/infra/bitrix/repositories/bitrix-products.repository'

/**
 * Compara cada plano ofertável com o price dele no gateway.
 *
 * **Por que isto existe:** o valor na SPA (`ufCrm89Value`) e o `unit_amount` do
 * gateway são duas fontes de verdade sobre o mesmo preço, e nada no produto as
 * reconcilia. A tela mostra o da SPA; o cartão é cobrado pelo do gateway. Divergir
 * significa o cliente ver um preço e pagar outro — e a descoberta acontece na
 * fatura, não na tela.
 *
 * Mesmo problema no intervalo: a SPA diz "mensal" e o price pode ser anual. A tela
 * diria "por mês" e a cobrança viria de uma vez.
 *
 * **Confere só o ambiente da chave em uso.** A SPA guarda um price id por ambiente e
 * o mapper já entrega o do ambiente derivado da `STRIPE_SECRET_KEY`, então o price
 * conferido e a conta consultada são sempre o mesmo par. Conferir o price do outro
 * ambiente aqui daria "price não encontrado" para todos eles — o de teste não existe
 * na conta live —, e o relatório apontaria cadastro errado onde só há ambiente
 * oposto.
 *
 * Plano cujo price id está vazio **neste** ambiente não é ofertável, logo não aparece
 * aqui. Quem responde "por que este plano não apareceu" é `yarn list:payment-plans`,
 * que mostra os dois campos lado a lado.
 *
 * Só leitura, nos dois lados — não escreve no CRM nem no gateway.
 */

/** Intervalo do domínio → o que o price do gateway precisa dizer. */
const EXPECTED_RECURRENCE: Record<
  Plan['interval'],
  { interval: string; count: number }
> = {
  monthly: { interval: 'month', count: 1 },
  quarterly: { interval: 'month', count: 3 },
  semiannual: { interval: 'month', count: 6 },
  yearly: { interval: 'year', count: 1 },
}

const EXPECTED_CURRENCY = 'brl'

const asMoney = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  if (!env.crmthinkWebhookUrl) {
    console.error('CRMTHINK_WEBHOOK_URL está vazio.')
    process.exit(1)
  }
  if (!env.payments.stripe.secretKey) {
    console.error(
      'STRIPE_SECRET_KEY está vazio: sem ela não há como conferir os prices.',
    )
    process.exit(1)
  }

  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const products = new BitrixProductRepository(bitrix)
  const plans = await new BitrixPlanRepository(bitrix, products).getPlans()

  /** O mesmo predicado de `ListOfferablePlans`: é o que a tela vai oferecer. */
  const offerable = plans.filter(
    plan => plan.active && plan.gatewayId && plan.provider,
  )

  console.log(
    `Ambiente do gateway conferido: ${env.payments.stripe.environment} ` +
      `(price ids de ${planGatewayIdField()})\n` +
      `Planos ofertáveis na SPA ${env.payments.spa.planEntityType}: ${offerable.length}\n`,
  )

  if (offerable.length === 0) {
    console.log(
      'Nenhum plano ofertável neste ambiente. Rode `yarn list:payment-plans` para ver ' +
        'por quê — o caso mais comum é o price id estar preenchido só no outro ambiente.',
    )
    return
  }

  const stripe = new Stripe(env.payments.stripe.secretKey)
  const problems: string[] = []

  for (const plan of offerable) {
    console.log(`--- plano ${plan.id} "${plan.name}" (${plan.provider})`)
    console.log(`    SPA: ${asMoney(plan.amount)} / ${plan.interval}`)

    let price: Stripe.Price
    try {
      /**
       * `tiers` só vem expandido: price escalonado tem `unit_amount: null` e o valor
       * mora nos degraus. Sem o expand, o valor cobrado é invisível aqui.
       */
      price = await stripe.prices.retrieve(plan.gatewayId!, {
        expand: ['tiers'],
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.log(`    GATEWAY: price não encontrado — ${detail}`)
      problems.push(
        `plano ${plan.id}: price "${plan.gatewayId}" não existe no gateway — o checkout vai falhar depois de o cliente escolher`,
      )
      continue
    }

    const recurring = price.recurring
    console.log(
      `    GATEWAY: ${price.unit_amount == null ? '(sem unit_amount)' : asMoney(price.unit_amount)}` +
        ` / ${recurring ? `${recurring.interval_count}×${recurring.interval}` : '(não recorrente)'}` +
        ` ${price.currency} ${price.active ? '' : '[INATIVO]'}`,
    )

    if (!price.active) {
      problems.push(
        `plano ${plan.id}: o price está inativo no gateway — a sessão de checkout é recusada lá`,
      )
    }

    /**
     * O divergente que mais cala: a tela mostra o valor da SPA e o cartão é
     * cobrado pelo do gateway. Ninguém percebe até a fatura.
     */
    if (price.unit_amount != null && price.unit_amount !== plan.amount) {
      problems.push(
        `plano ${plan.id}: a tela mostra ${asMoney(plan.amount)} e o gateway cobra ` +
          `${asMoney(price.unit_amount)} — o cliente vê um preço e paga outro`,
      )
    }

    /**
     * Price **escalonado** não tem valor único, e por isso não pode ser conferido
     * contra `ufCrm89Value` — só o primeiro degrau seria comparável, e comparar só ele
     * chamaria de OK um plano cuja segunda linha custa outra coisa.
     *
     * A checagem antiga silenciava aqui: `unit_amount` é `null` em tiered, então a
     * comparação nunca rodava e o relatório dizia "SPA e gateway concordam em valor"
     * sem ter conferido nada. Falso OK é pior que ausência de checagem, porque encerra
     * a investigação.
     *
     * O que sai agora são os degraus e o modo, para a conferência ser possível a olho
     * — e o aviso de que a tela, que multiplica `ufCrm89Value` pelo número de linhas,
     * **não** reproduz esta conta.
     */
    if (price.billing_scheme === 'tiered') {
      console.log(
        `    GATEWAY: escalonado (${price.tiers_mode ?? 'modo desconhecido'})` +
          (price.tiers
            ? `: ${price.tiers
                .map(
                  tier =>
                    `${tier.up_to == null ? 'acima' : `até ${tier.up_to}`} = ` +
                    `${tier.unit_amount == null ? '(sem unit_amount)' : asMoney(tier.unit_amount)}` +
                    (tier.flat_amount
                      ? ` + fixo ${asMoney(tier.flat_amount)}`
                      : ''),
                )
                .join(' · ')}`
            : ' (tiers não expandidos)'),
      )

      const firstTier = price.tiers?.[0]?.unit_amount
      if (firstTier != null && firstTier !== plan.amount) {
        problems.push(
          `plano ${plan.id}: o primeiro degrau do gateway é ${asMoney(firstTier)} e a ` +
            `SPA diz ${asMoney(plan.amount)} — a tela mostra o da SPA`,
        )
      }

      problems.push(
        `plano ${plan.id}: price escalonado (${price.tiers_mode ?? '?'}) e a tela calcula ` +
          `${asMoney(plan.amount)} × nº de linhas. Com mais de uma linha os dois números ` +
          'divergem, e o mostrado é o maior. O preço exibido tem que vir dos degraus do ' +
          'gateway, não de ufCrm89Value',
      )
    }

    if (!recurring) {
      problems.push(
        `plano ${plan.id}: o price não é recorrente, e a assinatura precisa de um que seja`,
      )
    } else {
      const expected = EXPECTED_RECURRENCE[plan.interval]
      if (
        recurring.interval !== expected.interval ||
        recurring.interval_count !== expected.count
      ) {
        problems.push(
          `plano ${plan.id}: a SPA diz "${plan.interval}" e o price cobra a cada ` +
            `${recurring.interval_count}×${recurring.interval} — a tela informa um ciclo e a cobrança usa outro`,
        )
      }
    }

    if (price.currency !== EXPECTED_CURRENCY) {
      problems.push(
        `plano ${plan.id}: o price está em "${price.currency}" e a tela formata em BRL`,
      )
    }
  }

  console.log('')
  if (problems.length === 0) {
    console.log('OK: SPA e gateway concordam em valor, ciclo e moeda.')
    return
  }

  console.log(`${problems.length} divergência(s):`)
  for (const problem of problems) console.log(`  - ${problem}`)
  process.exit(1)
}

main().catch(error => {
  console.error('Falha ao conferir os planos contra o gateway:', error)
  process.exit(1)
})
