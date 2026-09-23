import 'dotenv/config'

import { env } from '@/config/env'
import { SUBSCRIPTION_ITEM_PROVIDER_FIELD } from '@/modules/application/infra/bitrix/ensure-subscription-item-provider-field'
import { SUBSCRIPTION_ITEM_DELETED_AT_FIELD } from '@/modules/application/infra/bitrix/ensure-subscription-item-deletion-fields'
import { hubMessageClient } from '@/modules/portal/application/subscribe-thinkzap-line'
import {
  HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS,
  type HubMessageWebhookEvent,
} from '@/modules/thinkzap/infra/clients/types/hubmessage.types'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { resolveChannelWebhookEvents } from './resolve-channel-webhook-events'

/**
 * Garante que o webhook de cada canal HubMessage já existente assine todos os
 * eventos de `HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS` — em particular `CONNECTED` e
 * `DISCONNECTED`, que alimentam o campo Conectado do item da linha.
 *
 * Lista os webhooks do canal, acha o que aponta para `HUBMESSAGE_WEBHOOK_URL` e faz
 * `PATCH` com a **união** dos eventos (o `PATCH` substitui a lista). Idempotente
 * pela própria listagem.
 *
 * **Escreve só com `--apply`.** `--channel <id>` restringe a um canal — use num
 * canal de teste antes do `--apply` geral.
 *
 * **Um ambiente por vez.** A SPA é uma só para produção, homolog e dev, e cada canal
 * aponta para a URL do ambiente que o criou. O script só mexe em webhook da URL do
 * `.env` em uso; canal com webhook de outra URL é reportado e pulado. Canal **sem**
 * webhook nenhum não diz de qual ambiente é, então só ganha um com
 * `--create-missing`, depois de conferido.
 */

function parseArgs(): {
  apply: boolean
  createMissing: boolean
  channel?: string
} {
  const args = process.argv.slice(2)
  const index = args.indexOf('--channel')
  const channel = index === -1 ? undefined : args[index + 1]
  return {
    apply: args.includes('--apply'),
    createMissing: args.includes('--create-missing'),
    ...(channel ? { channel } : {}),
  }
}

type RawItem = Record<string, unknown>

const text = (raw: unknown): string | undefined => {
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value === '' ? undefined : value
}

async function listChannelIds(bitrix: BitrixClient): Promise<string[]> {
  const channels = new Set<string>()
  let start: number | undefined = undefined

  do {
    const response = await bitrix.listCrmItems(
      env.payments.spa.subscriptionItemEntityType,
      { [`=${SUBSCRIPTION_ITEM_PROVIDER_FIELD}`]: 'HUBMESSAGE' },
      {
        select: [
          'id',
          'ufCrm93HubChanelId',
          SUBSCRIPTION_ITEM_DELETED_AT_FIELD,
        ],
        ...(start !== undefined && { start }),
      },
    )
    for (const item of (response.result?.items ?? []) as RawItem[]) {
      const channelId = text(item.ufCrm93HubChanelId)
      if (channelId && !text(item[SUBSCRIPTION_ITEM_DELETED_AT_FIELD])) {
        channels.add(channelId)
      }
    }
    start = response.next
  } while (start !== undefined)

  return [...channels]
}

async function main(): Promise<void> {
  const { apply, createMissing, channel } = parseArgs()
  const webhookUrl = env.hubMessage.webhookUrl
  if (!webhookUrl) throw new Error('HUBMESSAGE_WEBHOOK_URL não configurada')

  const client = hubMessageClient()
  const channels = channel
    ? [channel]
    : await listChannelIds(
        new BitrixClient({ webhook: env.crmthinkWebhookUrl }),
      )

  console.log(`Canais HubMessage: ${channels.length} | URL: ${webhookUrl}`)

  const counts = {
    updated: 0,
    created: 0,
    unchanged: 0,
    foreign: 0,
    missing: 0,
    failed: 0,
  }

  for (const channelId of channels) {
    try {
      const decision = resolveChannelWebhookEvents({
        webhooks: await client.listWebhooks(channelId),
        webhookUrl,
        requiredEvents: HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS,
      })

      if (decision.kind === 'unchanged') {
        counts.unchanged++
        console.log(
          `[inalterado] canal ${channelId} (webhook ${decision.webhookId})`,
        )
        continue
      }

      if (decision.kind === 'foreign') {
        counts.foreign++
        console.log(
          `[outra-url] canal ${channelId}: webhook(s) para ${decision.urls.join(', ')} — confira o HUBMESSAGE_WEBHOOK_URL deste .env`,
        )
        continue
      }

      const tag = apply ? '[gravado]' : '[dry-run]'

      if (decision.kind === 'update') {
        if (apply) {
          await client.updateWebhook(channelId, decision.webhookId, {
            events: decision.events,
          })
        }
        counts.updated++
        console.log(
          `${tag} canal ${channelId}: webhook ${decision.webhookId} + ${decision.missing.join(', ')}`,
        )
        continue
      }

      if (!createMissing) {
        counts.missing++
        console.log(
          `[sem-webhook] canal ${channelId}: nenhum webhook — confira de qual ambiente é e rode com --create-missing`,
        )
        continue
      }

      if (apply) {
        await client.createWebhook(channelId, {
          url: webhookUrl,
          events: decision.events as HubMessageWebhookEvent[],
        })
      }
      counts.created++
      console.log(
        `${tag} canal ${channelId}: webhook novo (${decision.events.join(', ')})`,
      )
    } catch (error) {
      counts.failed++
      console.error(`[falhou] canal ${channelId}:`, error)
    }
  }

  console.log(
    `\nResumo${apply ? '' : ' (dry-run)'}: ${counts.updated} atualizado(s), ` +
      `${counts.created} criado(s), ${counts.unchanged} inalterado(s), ${counts.foreign} com outra URL, ${counts.missing} sem webhook, ${counts.failed} falha(s)`,
  )
  if (!apply) console.log('Nada foi gravado. Rode com --apply para gravar.')
}

void main().catch(error => {
  console.error(
    'Sincronização dos eventos de webhook HubMessage falhou:',
    error,
  )
  process.exit(1)
})
