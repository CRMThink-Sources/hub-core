import 'dotenv/config'

import { ensureSpaTextField } from '@/modules/application/infra/bitrix/ensure-spa-text-field'
import { env } from '@/config/env'
import {
  BITRIX_ENTITY_TYPES,
  BITRIX_SPA_CLIENT_FIELDS,
} from '@/shared/domain/config/bitrix.env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Verifica os quatro campos de contato do item de cliente da SPA 1060.
 *
 * Nenhum campo novo é criado por esta feature — os quatro já existem e já são
 * escritos na criação do item. O que esta verificação pega é o code **errado**:
 * `crm.item.update` aceita campo desconhecido e responde sucesso, descartando o
 * valor. O contato seria "gravado" e nunca apareceria no CRM, sem erro e sem log.
 *
 * Reprova campo de lista pelo mesmo motivo que `ensureSpaTextField` reprova:
 * telefone e empresa vindos do cliente não cabem em enumeração, e lista devolve
 * id de enum na leitura em vez do valor.
 *
 * Só leitura — não escreve nada no CRM.
 */
const CONTACT_FIELDS = [
  { field: BITRIX_SPA_CLIENT_FIELDS.NAME, label: 'nome' },
  { field: BITRIX_SPA_CLIENT_FIELDS.EMAIL, label: 'e-mail' },
  { field: BITRIX_SPA_CLIENT_FIELDS.PHONE, label: 'telefone' },
  { field: BITRIX_SPA_CLIENT_FIELDS.COMPANY, label: 'empresa' },
] as const

async function main() {
  if (!env.crmthinkWebhookUrl) {
    console.error(
      'CRMTHINK_WEBHOOK_URL está vazio: sem ele não há como consultar a SPA.',
    )
    process.exit(1)
  }

  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const entityTypeId = BITRIX_ENTITY_TYPES.SPA_CLIENT

  console.log(`\n=== Contato do cliente (SPA ${entityTypeId}) ===\n`)

  const response = await bitrix.getCrmItemFields(entityTypeId)
  const fields = response.result?.fields ?? {}

  console.log('Todos os userfields da SPA:')
  for (const name of Object.keys(fields).filter(name => /^ufCrm/.test(name))) {
    const expected = CONTACT_FIELDS.some(entry => entry.field === name)
    console.log(
      `  ${name}  type=${JSON.stringify(fields[name]?.type)}` +
        (expected ? '  <== ESPERADO' : ''),
    )
  }

  console.log('')

  let failed = false
  for (const { field, label } of CONTACT_FIELDS) {
    try {
      await ensureSpaTextField({
        bitrix,
        entityTypeId,
        field,
        hint: `É o campo de ${label} do contato capturado na ativação do trial.`,
      })
      console.log(`OK: ${label} (${field}) existe e é campo de texto.`)
    } catch (error) {
      failed = true
      console.error(
        `FALHOU: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (failed) process.exit(1)
}

main().catch(error => {
  console.error('Falha ao consultar os campos da SPA 1060:', error)
  process.exit(1)
})
