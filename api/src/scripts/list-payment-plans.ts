import 'dotenv/config'

import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Lista **cru** os itens da SPA de planos, sem passar pelo mapper.
 *
 * Diagnóstico: `THINKZAP_TRIAL_PLAN_ID` tem que ser o id de um plano que o mapper
 * aceite. Um item com valor ou intervalo nulo é reprovado, e como o mapper reprova
 * o item inteiro, `getPlan` lança — o que a rota de trial traduz para
 * `misconfigured` e a tela mostra como "Teste indisponível".
 *
 * Cru de propósito: pelo mapper, um único item inválido derruba a listagem toda e
 * esconde os que estão bons.
 *
 * Só leitura — não escreve nada no CRM.
 */
const FIELDS = {
  value: 'ufCrm89Value',
  interval: 'ufCrm89Interval',
  product: 'ufCrm89Product',
  active: 'ufCrm89Active',
  /**
   * Price id no gateway. É o que separa plano **ofertável** de plano de trial, e o
   * que `GET /thinkzap/plans` filtra — sem ele na saída, "por que meu plano não
   * aparece no checkout" não tem resposta aqui.
   */
  gatewayId: 'ufCrm89GatewayId',
  /**
   * Conector que o plano precifica. Plano pago **sem** ele não é ofertável — falha
   * fechada, porque sem saber o que o plano cobre não há como impedir a linha errada
   * de contratá-lo. O sintoma é "nenhum plano disponível", então a coluna existe
   * para o diagnóstico apontar a causa.
   */
  provider: 'ufCrm89Provider',
} as const

const VALID_PROVIDERS = ['ZAPI', 'HUBMESSAGE']

async function main() {
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const configured = env.payments.trialPlanId

  console.log(
    `SPA de planos: ${env.payments.spa.planEntityType}\n` +
      `THINKZAP_TRIAL_PLAN_ID configurado: ${configured || '(vazio)'}\n`,
  )

  const response = await bitrix.listCrmItems(
    env.payments.spa.planEntityType,
    {},
  )
  const items = (response.result?.items ?? []) as Array<Record<string, unknown>>

  if (items.length === 0) {
    console.log('Nenhum item na SPA de planos.')
    return
  }

  for (const item of items) {
    const id = String(item.id)
    const value = item[FIELDS.value]
    const interval = item[FIELDS.interval]
    const gatewayId = item[FIELDS.gatewayId]
    const active = item[FIELDS.active]
    const usable = value != null && value !== '' && interval != null

    /**
     * Os dois papéis são mutuamente exclusivos por construção: plano **com** price
     * id é ofertável no checkout, plano **sem** é o de trial. É o que separa os dois
     * sem precisar de uma flag "é trial" — e por isso um plano de trial que ganhe
     * `gatewayId` por acidente passa a ser cobrado.
     */
    const hasGatewayId = gatewayId != null && gatewayId !== ''
    const isActive = active !== false && active !== 'N' && active !== 0
    const provider = item[FIELDS.provider]
    // Só escalar vira texto: outra coisa aqui é cadastro errado, e viraria
    // `[object Object]` na comparação.
    const providerText =
      typeof provider === 'string' || typeof provider === 'number'
        ? String(provider).trim().toUpperCase()
        : ''
    const hasProvider = VALID_PROVIDERS.includes(providerText)

    const role = !hasGatewayId
      ? 'TRIAL (grátis)   '
      : !isActive
        ? 'PAGO/INATIVO     '
        : !hasProvider
          ? 'PAGO/SEM PROVIDER'
          : 'PAGO/OFERTÁVEL   '

    console.log(
      [
        `id=${id}`,
        usable ? 'OK      ' : 'INVÁLIDO',
        role,
        `titulo="${typeof item.title === 'string' ? item.title : ''}"`,
        `${FIELDS.value}=${JSON.stringify(value)}`,
        `${FIELDS.interval}=${JSON.stringify(interval)}`,
        `${FIELDS.gatewayId}=${JSON.stringify(gatewayId)}`,
        `${FIELDS.provider}=${JSON.stringify(provider)}`,
        `${FIELDS.active}=${JSON.stringify(active)}`,
        `${FIELDS.product}=${JSON.stringify(item[FIELDS.product])}`,
        id === configured ? '<== TRIAL CONFIGURADO' : '',
      ].join('  '),
    )
  }

  /**
   * O plano de trial com price id é a inconsistência que mais cala: `isTrialSubscription`
   * deriva "é teste" de **não ter** `gatewayId`, então um trial com price id passa a
   * ser lido como assinatura paga — a tela oferece portal de faturamento e para de
   * oferecer contratação, para quem nunca pagou.
   */
  const trialItem = items.find(item => String(item.id) === configured)
  const trialGatewayId = trialItem?.[FIELDS.gatewayId]
  if (trialGatewayId != null && trialGatewayId !== '') {
    console.log(
      `\nATENÇÃO: o plano de trial "${configured}" tem ${FIELDS.gatewayId}=` +
        `${JSON.stringify(trialGatewayId)}. O produto deriva "é teste" da ausência ` +
        'desse campo, então este plano será lido como assinatura paga. Limpe o campo.',
    )
  }

  const configuredItem = items.find(item => String(item.id) === configured)

  console.log('')
  if (!configured) {
    console.log('THINKZAP_TRIAL_PLAN_ID está vazio.')
  } else if (!configuredItem) {
    console.log(`O id "${configured}" não existe nesta SPA.`)
  } else {
    const value = configuredItem[FIELDS.value]
    const interval = configuredItem[FIELDS.interval]
    if (value == null || value === '' || interval == null) {
      console.log(
        `O plano "${configured}" existe mas está incompleto: ` +
          `${FIELDS.value} e/ou ${FIELDS.interval} vazios. O mapper reprova o item, ` +
          '`getPlan` lança, e o trial aparece como indisponível. Preencha os dois no CRM.',
      )
    } else {
      console.log(`O plano "${configured}" parece utilizável.`)
    }
  }
}

main().catch(error => {
  console.error('Falha ao listar planos:', error)
  process.exit(1)
})
