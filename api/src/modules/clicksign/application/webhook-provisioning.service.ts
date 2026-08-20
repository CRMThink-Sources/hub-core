import { randomUUID } from 'node:crypto'
import { env } from '@/config/env'
import { CLICKSIGN_WEBHOOK_EVENTS } from '../clicksign.constants'
import { ClicksignClient } from '../infra/clients/clicksign.client'
import { safeErrorMessage } from '../infra/clients/clicksign-error'
import { logClicksignError } from '../errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

export interface TokenWebhook {
  ref: string
  id: string
  secret?: string
  url: string
  env: 'prod' | 'sandbox'
  events?: string[]
}

export interface ProvisionableToken {
  token: string
  ambiente: 'prod' | 'sandbox'
  webhook?: TokenWebhook
  [key: string]: unknown
}

// Por conta: cria o webhook se não existe; re-registra (delete+create) se
// url/env/eventos divergem; senão no-op. Best-effort — o caller engole erros.
export class WebhookProvisioningService {
  constructor(private readonly appId: string) {}

  async sync(
    tokens: ProvisionableToken[],
  ): Promise<{ tokens: ProvisionableToken[]; changed: boolean }> {
    let changed = false
    const updated = await Promise.all(
      tokens.map(async token => {
        try {
          const result = await this.syncToken(token)
          if (result.changed) changed = true
          return result.token
        } catch (error) {
          logClicksignError(
            apiLogger,
            'clicksign.provisioning.webhook_sync_failed',
            {
              appId: this.appId,
              err: safeErrorMessage(error),
            },
          )
          return token
        }
      }),
    )
    return { tokens: updated, changed }
  }

  private async syncToken(
    token: ProvisionableToken,
  ): Promise<{ token: ProvisionableToken; changed: boolean }> {
    const ref = token.webhook?.ref ?? randomUUID()
    const desiredUrl = `${env.apiUrl}/clicksign/webhook/${this.appId}/${ref}`
    const desiredEnv = token.ambiente
    const client = new ClicksignClient(desiredEnv)

    if (
      token.webhook &&
      token.webhook.url === desiredUrl &&
      token.webhook.env === desiredEnv &&
      sameEvents(token.webhook.events, CLICKSIGN_WEBHOOK_EVENTS)
    ) {
      return { token, changed: false }
    }

    // Drift → remove o antigo antes de recriar.
    if (token.webhook?.id) {
      try {
        await client.deleteWebhook(token.token, token.webhook.id)
      } catch (error) {
        apiLogger.warn(
          { app: 'clicksign', err: safeErrorMessage(error) },
          'Delete do webhook antigo falhou',
        )
      }
    }

    const created = await client.registerWebhook(token.token, {
      url: desiredUrl,
      events: CLICKSIGN_WEBHOOK_EVENTS,
    })

    apiLogger.info(
      { app: 'clicksign', appId: this.appId, ref, env: desiredEnv },
      'Webhook registrado na Clicksign',
    )

    return {
      token: {
        ...token,
        webhook: {
          ref,
          id: created.id,
          secret: created.secret,
          url: desiredUrl,
          env: desiredEnv,
          events: [...CLICKSIGN_WEBHOOK_EVENTS],
        },
      },
      changed: true,
    }
  }
}

function sameEvents(a: string[] | undefined, b: readonly string[]): boolean {
  if (!a || a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((ev, i) => ev === sortedB[i])
}
