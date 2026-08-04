import 'dotenv/config'

import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import {
  SUBSCRIPTION_ITEM_SETTINGS_FIELD,
  ensureSubscriptionItemSettingsField,
} from '@/modules/application/infra/bitrix/ensure-subscription-item-settings-field'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import {
  findLineItemByChannelId,
  findLineItemByInstanceId,
} from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  hasPersistedSettings,
  settingsToMigrate,
} from './resolve-connector-settings-backfill'

/**
 * Migra `ConnectorSettings` de `core_thinkerszap_instances.settings` para
 * `ufCrm93Settings` no item da SPA 1146, que é a fonte única depois de
 * `move-connector-settings-to-spa`.
 *
 * Escreve só com `--apply`. Sem a flag é relatório — é configuração de cliente em
 * produção, e o default seguro é não tocar em nada.
 *
 * **Idempotente:** item cujo campo já está preenchido é pulado, nunca sobrescrito.
 * O que o cliente configurou depois do corte de leitura vale mais que o valor
 * congelado no banco, então um re-run não pode desfazê-lo.
 *
 * **Aborta antes de escrever** se `ufCrm93Settings` não existir na SPA:
 * `crm.item.update` aceita campo desconhecido e responde sucesso, descartando o
 * valor — sem a verificação, o backfill relataria sucesso tendo gravado no vazio.
 */

/** Filtro por lote na listagem da SPA, mesmo limite do `backfill-aplication-spa-id`. */
const BATCH_SIZE = 50

type InstanceRow = {
  id: string
  domainId: string
  instanceId: string
  channelId: string | null
  settings: unknown
}

type Outcome =
  | { kind: 'migrated'; itemId: string; settings: ConnectorSettings }
  | { kind: 'skipped'; itemId: string; reason: 'já preenchido' }
  | { kind: 'nothing-to-migrate' }
  | { kind: 'no-item' }

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.slice(2).includes('--apply') }
}

/**
 * Lê o valor cru do campo na SPA. Precisa ser cru: a entidade
 * `SubscriptionItem.settings` já vem com os defaults resolvidos, então pelo
 * domínio é impossível distinguir "nunca gravado" de "gravado igual ao default"
 * — e essa distinção é exatamente o critério de idempotência.
 */
async function readRawSettingsField(
  bitrix: BitrixClient,
  itemId: string,
): Promise<unknown> {
  const response = await bitrix.getCrmItem(
    env.payments.spa.subscriptionItemEntityType,
    itemId,
  )

  return response.result?.item?.[SUBSCRIPTION_ITEM_SETTINGS_FIELD]
}

async function resolveOutcome(
  row: InstanceRow,
  deps: {
    bitrix: BitrixClient
    getAplicationContext: ReturnType<typeof makeGetAplicationContext>
    appCode: string
  },
): Promise<Outcome> {
  const settings = settingsToMigrate(row.settings)
  if (!settings) return { kind: 'nothing-to-migrate' }

  /**
   * Linha HubMessage é resolvida pelo canal; Z-API pelo `instanceId`. A coluna
   * `channel_id` só é preenchida no caminho HubMessage, então ela é o
   * discriminador — e não depende de `Connector`, que pode não existir para linha
   * nascida na SPA.
   */
  const line = row.channelId
    ? await findLineItemByChannelId(
        {
          channelId: row.channelId,
          domainId: row.domainId,
          appCode: deps.appCode,
        },
        deps.getAplicationContext,
      )
    : await findLineItemByInstanceId(
        {
          instanceId: row.instanceId,
          domainId: row.domainId,
          appCode: deps.appCode,
        },
        deps.getAplicationContext,
      )

  if (!line) return { kind: 'no-item' }

  /**
   * O `entitlement` da resolução é ignorado de propósito: o backfill migra
   * configuração de linha bloqueada também. O dado da coluna é o que o cliente
   * tinha, e não migrá-lo perderia a configuração de quem estiver com o trial
   * vencido no momento do run.
   */
  const item = line.item

  const raw = await readRawSettingsField(deps.bitrix, item.id)
  if (hasPersistedSettings(raw)) {
    return { kind: 'skipped', itemId: item.id, reason: 'já preenchido' }
  }

  return { kind: 'migrated', itemId: item.id, settings }
}

async function main() {
  const { apply } = parseArgs()

  const rows = (await prisma.instance.findMany({
    select: {
      id: true,
      domainId: true,
      instanceId: true,
      channelId: true,
      settings: true,
    },
    orderBy: { createdAt: 'asc' },
  })) as InstanceRow[]

  if (rows.length === 0) {
    console.log('Nada a fazer: core_thinkerszap_instances está vazia.')
    return
  }

  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })

  /**
   * Antes de qualquer escrita, e antes até de resolver item: se o campo não existe
   * na SPA, todo o resto é trabalho perdido em silêncio.
   */
  await ensureSubscriptionItemSettingsField(bitrix)

  const items = makeSubscriptionItemRepository()
  const getAplicationContext = makeGetAplicationContext()
  const appCode = thinkzapAppCodeId()

  let migrated = 0
  let skipped = 0
  let nothingToMigrate = 0
  let noItem = 0
  let failed = 0

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    for (const row of rows.slice(start, start + BATCH_SIZE)) {
      const label = row.channelId
        ? `canal ${row.channelId}`
        : `instância ${row.instanceId}`

      let outcome: Outcome
      try {
        outcome = await resolveOutcome(row, {
          bitrix,
          getAplicationContext,
          appCode,
        })
      } catch (error) {
        // Falha de leitura do contexto é infraestrutura e não invalida as outras
        // linhas: registra e segue, o resumo diz quantas ficaram de fora.
        failed += 1
        console.error(
          `[falha] ${label}:`,
          error instanceof Error ? error.message : error,
        )
        continue
      }

      switch (outcome.kind) {
        case 'nothing-to-migrate':
          nothingToMigrate += 1
          continue
        case 'no-item':
          noItem += 1
          console.warn(
            `[sem item] ${label}: nenhum item de assinatura corresponde (linha órfã na SPA)`,
          )
          continue
        case 'skipped':
          skipped += 1
          console.log(
            `[pulado] ${label} → item ${outcome.itemId}: ${outcome.reason}`,
          )
          continue
        case 'migrated':
          break
      }

      if (!apply) {
        migrated += 1
        console.log(
          `[dry-run] ${label} → item ${outcome.itemId}: ${JSON.stringify(outcome.settings)}`,
        )
        continue
      }

      try {
        /**
         * Pelo repositório decorado, não pelo `BitrixClient` cru: é o que invalida
         * e regrava as chaves de cache que o contexto lê. Escrita direta deixaria
         * o Redis servindo o valor antigo por até 5 min.
         */
        await items.updateSubscriptionItem(outcome.itemId, {
          settings: outcome.settings,
        })
        migrated += 1
        console.log(
          `[migrado] ${label} → item ${outcome.itemId}: ${JSON.stringify(outcome.settings)}`,
        )
      } catch (error) {
        failed += 1
        console.error(
          `[falha na gravação] ${label} → item ${outcome.itemId}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  console.log(
    `\nResumo${apply ? '' : ' (dry-run — nada gravado, use --apply)'}: ` +
      `${migrated} migrado(s), ${skipped} pulado(s) por já ter valor, ` +
      `${nothingToMigrate} sem configuração a migrar, ` +
      `${noItem} sem item correspondente, ${failed} falha(s), ` +
      `de ${rows.length} instância(s).`,
  )
}

// Instância sem item é estado esperado (linha removida da SPA, row órfã), então não
// vira código de saída diferente de zero — o resumo é o relatório. Campo ausente na
// SPA, sim: aquilo é pré-requisito não cumprido e aborta antes de escrever.
main()
  .catch(error => {
    console.error('Falha no backfill de settings do conector:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
