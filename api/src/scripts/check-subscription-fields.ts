import 'dotenv/config'

import { env } from '@/config/env'
import {
  PLAN_GATEWAY_ID_FIELDS,
  ensurePlanGatewayIdFields,
} from '@/modules/application/infra/bitrix/ensure-plan-gateway-id-fields'
import {
  PLAN_PROVIDER_FIELD,
  ensurePlanProviderField,
} from '@/modules/application/infra/bitrix/ensure-plan-provider-field'
import {
  SUBSCRIPTION_ITEM_PROVIDER_FIELD,
  ensureSubscriptionItemProviderField,
} from '@/modules/application/infra/bitrix/ensure-subscription-item-provider-field'
import {
  SUBSCRIPTION_MODALITY_FIELD,
  ensureSubscriptionModalityField,
} from '@/modules/application/infra/bitrix/ensure-subscription-modality-field'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Verifica os campos de SPA que esta feature exige, e diz se estão utilizáveis.
 *
 * Existe porque `crm.item.update` aceita campo desconhecido e **responde sucesso**,
 * descartando o valor. Um code com sufixo diferente do esperado, ou um campo criado
 * como lista, produzem o mesmo sintoma: toda assinatura lê `manual`, o cliente do
 * gateway perde o portal de faturamento, e não há erro nem log em lugar nenhum.
 *
 * Roda a **mesma** verificação que a ativação roda (`ensureSubscriptionModalityField`),
 * para o diagnóstico e o runtime nunca discordarem.
 *
 * Só leitura — não escreve nada no CRM.
 */
/** Lista os userfields de uma SPA e roda a verificação de pré-requisito dela. */
async function checkSpa(input: {
  bitrix: BitrixClient
  label: string
  entityTypeId: number
  /**
   * Os campos que a verificação exige. É lista porque o price id do plano são
   * **dois** campos, um por ambiente do gateway, e os dois têm que existir para a
   * leitura distinguir plano de trial de plano configurado só no outro ambiente.
   */
  expectedFields: string[]
  /** Regex dos codes parecidos, para "existe com outro nome" não parecer "não existe". */
  similar: RegExp
  verify: () => Promise<void>
}): Promise<boolean> {
  console.log(`\n=== ${input.label} (SPA ${input.entityTypeId}) ===`)
  console.log(`Campos esperados: ${input.expectedFields.join(', ')}\n`)

  const response = await input.bitrix.getCrmItemFields(input.entityTypeId)
  const fields = response.result?.fields ?? {}

  const candidates = Object.keys(fields).filter(name =>
    input.similar.test(name),
  )

  console.log('Campos parecidos encontrados:')
  if (candidates.length === 0) {
    console.log('  (nenhum)')
  } else {
    for (const name of candidates) {
      console.log(
        `  ${name}  type=${JSON.stringify(fields[name]?.type)}` +
          (input.expectedFields.includes(name) ? '  <== ESPERADO' : ''),
      )
    }
  }

  const faltando = input.expectedFields.filter(name => !fields[name])
  if (faltando.length > 0) {
    console.log(`\nEsperados e AUSENTES: ${faltando.join(', ')}`)
  }

  console.log('\nTodos os userfields:')
  for (const name of Object.keys(fields).filter(name => /^ufCrm/.test(name))) {
    console.log(`  ${name}  type=${JSON.stringify(fields[name]?.type)}`)
  }

  console.log('')
  try {
    await input.verify()
    console.log(
      `OK: ${input.expectedFields
        .map(name => `"${name}"`)
        .join(', ')} existe(m) e é(são) legível(is) pelo mapper.`,
    )
    return true
  } catch (error) {
    console.error(
      `FALHOU: ${error instanceof Error ? error.message : String(error)}`,
    )
    return false
  }
}

async function main() {
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })

  if (!env.crmthinkWebhookUrl) {
    console.error(
      'CRMTHINK_WEBHOOK_URL está vazio: sem ele não há como consultar a SPA.',
    )
    process.exit(1)
  }

  const results = [
    await checkSpa({
      bitrix,
      label: 'Assinaturas — modalidade de cobrança',
      entityTypeId: env.payments.spa.subscriptionEntityType,
      expectedFields: [SUBSCRIPTION_MODALITY_FIELD],
      similar: /modalit|modalidad/i,
      verify: () =>
        ensureSubscriptionModalityField(
          bitrix,
          env.payments.spa.subscriptionEntityType,
        ),
    }),
    await checkSpa({
      bitrix,
      label: 'Planos — conector que o plano precifica',
      entityTypeId: env.payments.spa.planEntityType,
      expectedFields: [PLAN_PROVIDER_FIELD],
      similar: /provider|conector|connector/i,
      verify: () =>
        ensurePlanProviderField(bitrix, env.payments.spa.planEntityType),
    }),
    await checkSpa({
      bitrix,
      label: `Planos — price id por ambiente (em uso: ${env.payments.stripe.environment})`,
      entityTypeId: env.payments.spa.planEntityType,
      expectedFields: [
        PLAN_GATEWAY_ID_FIELDS.production,
        PLAN_GATEWAY_ID_FIELDS.homolog,
      ],
      /**
       * `/gateway/i` e não o nome exato: o campo de homologação é criado à mão no
       * portal, e o modo mais provável de errar é o sufixo (`...Homol`,
       * `...GatewayHomolog`). Sem os parecidos na saída, "existe com outro nome"
       * apareceria como "não existe" e alguém criaria um terceiro campo.
       */
      similar: /gateway|price/i,
      verify: () =>
        ensurePlanGatewayIdFields(bitrix, env.payments.spa.planEntityType),
    }),
    await checkSpa({
      bitrix,
      label: 'Itens — provider do conector da linha',
      entityTypeId: env.payments.spa.subscriptionItemEntityType,
      expectedFields: [SUBSCRIPTION_ITEM_PROVIDER_FIELD],
      similar: /provider|conector|connector/i,
      verify: () =>
        ensureSubscriptionItemProviderField(
          bitrix,
          env.payments.spa.subscriptionItemEntityType,
        ),
    }),
  ]

  if (results.includes(false)) process.exit(1)
}

main().catch(error => {
  console.error('Falha ao consultar os campos da SPA:', error)
  process.exit(1)
})
