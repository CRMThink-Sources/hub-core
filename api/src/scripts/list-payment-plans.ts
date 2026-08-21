import 'dotenv/config'

import { env } from '@/config/env'
import {
  PLAN_GATEWAY_ID_FIELDS,
  planGatewayIdField,
} from '@/modules/application/infra/bitrix/ensure-plan-gateway-id-fields'
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
   * Price id no gateway, **um por ambiente**. É o que separa plano **ofertável** de
   * plano de trial, e o que `GET /thinkzap/plans` filtra — sem ele na saída, "por que
   * meu plano não aparece no checkout" não tem resposta aqui.
   *
   * Os dois saem na listagem, e não só o do ambiente em uso: a causa mais comum de
   * plano sumido é o price id ter sido cadastrado só no outro lado, e ver os dois é o
   * que transforma "não aparece" em "está no campo errado".
   */
  gatewayId: PLAN_GATEWAY_ID_FIELDS.production,
  gatewayIdHomolog: PLAN_GATEWAY_ID_FIELDS.homolog,
  /**
   * Conector que o plano precifica. Plano pago **sem** ele não é ofertável — falha
   * fechada, porque sem saber o que o plano cobre não há como impedir a linha errada
   * de contratá-lo. O sintoma é "nenhum plano disponível", então a coluna existe
   * para o diagnóstico apontar a causa.
   */
  provider: 'ufCrm89Provider',
} as const

const VALID_PROVIDERS = ['ZAPI', 'HUBMESSAGE']

/** O que cada conector vende, para a linha de cobertura dizer o que falta. */
const PROVIDER_LABELS: Record<string, string> = {
  ZAPI: 'WhatsApp Web',
  HUBMESSAGE: 'WhatsApp Business/Oficial',
}

const isFilled = (value: unknown): boolean => value != null && value !== ''

/**
 * Cobertura por conector: cada provider vendável precisa de **um** plano ofertável no
 * ambiente em uso.
 *
 * Sem esta seção, conector sem plano só aparece no meio de uma contratação real, como
 * `PlanForProviderMissingError` — depois de o cliente clicar. Zero plano e dois planos
 * são erros distintos e os dois recusam: dois deixam a resolução ambígua, e escolher
 * cobraria o preço de um pelo uso do outro.
 */
function reportProviderCoverage(input: {
  environment: string
  currentField: string
  offerableByProvider: Map<string, string[]>
  withoutPriceIdByProvider: Map<string, string[]>
}): void {
  console.log(`\nCobertura por conector no ambiente "${input.environment}":`)

  for (const provider of VALID_PROVIDERS) {
    const label = PROVIDER_LABELS[provider] ?? provider
    const offerable = input.offerableByProvider.get(provider) ?? []
    const withoutPriceId = input.withoutPriceIdByProvider.get(provider) ?? []

    if (offerable.length === 1) {
      console.log(`  ${provider} (${label}): OK — plano ${offerable[0]}`)
      continue
    }

    if (offerable.length > 1) {
      console.log(
        `  ${provider} (${label}): AMBÍGUO — ${offerable.length} planos ofertáveis ` +
          `(${offerable.join(', ')}). A contratação recusa em vez de escolher: ` +
          'escolher cobraria o preço de um plano pelo uso do outro. Inative os ' +
          'excedentes.',
      )
      continue
    }

    if (withoutPriceId.length > 0) {
      console.log(
        `  ${provider} (${label}): SEM PRICE ID — plano(s) ${withoutPriceId.join(', ')} ` +
          `declaram o conector mas estão com ${input.currentField} vazio. Preencha o ` +
          'campo; o item já existe.',
      )
      continue
    }

    console.log(
      `  ${provider} (${label}): SEM PLANO — nenhum item ativo declara este conector. ` +
        'Cadastre o plano na SPA com o provider e o price id dos dois ambientes.',
    )
  }
}

async function main() {
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const configured = env.payments.trialPlanId
  const environment = env.payments.stripe.environment
  const currentField = planGatewayIdField(environment)

  console.log(
    `SPA de planos: ${env.payments.spa.planEntityType}\n` +
      `Ambiente do gateway em uso: ${environment} (derivado do prefixo de ` +
      `STRIPE_SECRET_KEY)\n` +
      `Campo de price id lido pelo runtime: ${currentField}\n` +
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

  /** Cobertura por conector, acumulada na varredura e reportada no fim. */
  const offerableByProvider = new Map<string, string[]>()
  const withoutPriceIdByProvider = new Map<string, string[]>()

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
    const gatewayIdHomolog = item[FIELDS.gatewayIdHomolog]
    const currentGatewayId =
      environment === 'production' ? gatewayId : gatewayIdHomolog
    const otherGatewayId =
      environment === 'production' ? gatewayIdHomolog : gatewayId

    const hasGatewayId = isFilled(currentGatewayId)
    const isActive = active !== false && active !== 'N' && active !== 0
    const provider = item[FIELDS.provider]
    // Só escalar vira texto: outra coisa aqui é cadastro errado, e viraria
    // `[object Object]` na comparação.
    const providerText =
      typeof provider === 'string' || typeof provider === 'number'
        ? String(provider).trim().toUpperCase()
        : ''
    const hasProvider = VALID_PROVIDERS.includes(providerText)

    /**
     * "Só no outro ambiente" é papel próprio, e não trial: os dois resolvem
     * `gatewayId: undefined` no mapper, mas um é grátis de propósito e o outro é
     * cadastro pela metade. Confundir os dois libera linha paga sem cobrança.
     */
    const role = !hasGatewayId
      ? isFilled(otherGatewayId)
        ? 'SÓ NO OUTRO AMB. '
        : 'TRIAL (grátis)   '
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
        `${FIELDS.gatewayId}=${JSON.stringify(gatewayId)}` +
          (FIELDS.gatewayId === currentField ? ' <==' : ''),
        `${FIELDS.gatewayIdHomolog}=${JSON.stringify(gatewayIdHomolog)}` +
          (FIELDS.gatewayIdHomolog === currentField ? ' <==' : ''),
        `${FIELDS.provider}=${JSON.stringify(provider)}`,
        `${FIELDS.active}=${JSON.stringify(active)}`,
        `${FIELDS.product}=${JSON.stringify(item[FIELDS.product])}`,
        id === configured ? '<== TRIAL CONFIGURADO' : '',
      ].join('  '),
    )

    if (isActive && hasProvider && hasGatewayId) {
      offerableByProvider.set(providerText, [
        ...(offerableByProvider.get(providerText) ?? []),
        id,
      ])
    }

    if (isActive && hasProvider && !hasGatewayId) {
      withoutPriceIdByProvider.set(providerText, [
        ...(withoutPriceIdByProvider.get(providerText) ?? []),
        id,
      ])
    }
  }

  reportProviderCoverage({
    environment,
    currentField,
    offerableByProvider,
    withoutPriceIdByProvider,
  })

  /**
   * O plano de trial com price id é a inconsistência que mais cala: `isTrialSubscription`
   * deriva "é teste" de **não ter** `gatewayId`, então um trial com price id passa a
   * ser lido como assinatura paga — a tela oferece portal de faturamento e para de
   * oferecer contratação, para quem nunca pagou.
   */
  const trialItem = items.find(item => String(item.id) === configured)
  for (const field of [FIELDS.gatewayId, FIELDS.gatewayIdHomolog]) {
    const trialGatewayId = trialItem?.[field]
    if (!isFilled(trialGatewayId)) continue

    console.log(
      `\nATENÇÃO: o plano de trial "${configured}" tem ${field}=` +
        `${JSON.stringify(trialGatewayId)}. O produto deriva "é teste" da ausência ` +
        'desse campo, então este plano será lido como assinatura paga ' +
        `${field === currentField ? 'neste ambiente' : `no ambiente que lê ${field}`}. ` +
        'Limpe o campo.',
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
