import { env } from '@/config/env'
import { CLICKSIGN_CANCEL_HANDLER_PATH } from '../clicksign.constants'
import { buildClicksignRobotAddParams } from './build-robot-params'
import {
  SIGNER_PART_FIELD,
  buildSignerPartFieldParams,
} from './build-signer-part-field-params'
import { ClicksignClient } from '../infra/clients/clicksign.client'
import {
  ProvisionableToken,
  WebhookProvisioningService,
} from './webhook-provisioning.service'
import { safeErrorMessage } from '../infra/clients/clicksign-error'
import { apiLogger } from '@/shared/infra/logger'
import type { ClickSignSettingsRepository } from '../domain/repositories/clicksign-settings.repository'

export interface BitrixCaller {
  callMethod<T = unknown>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T>
}

export type CheckStatus = 'ok' | 'missing'
export type WebhookCheck = { token: string; status: CheckStatus }
export type ProvisioningStatus = {
  robot: CheckStatus
  event: CheckStatus
  signerField: CheckStatus
  webhooks?: WebhookCheck[]
}

// `appId` é o id do app instalado (não o appCode) — casa com a URL do webhook
// `/clicksign/webhook/{appId}/{ref}` e com `settings.findByAppId`.
export interface WebhookContext {
  appId: string
  settings: ClickSignSettingsRepository
}

const CANCEL_EVENT = 'oncrmtimelineitemaction'

// Fonte de verdade é o Bitrix/Clicksign ao vivo (o usuário pode deletar
// pós-install), por isso não cacheia.
export class ProvisioningService {
  constructor(
    private readonly client: BitrixCaller,
    private readonly webhookCtx?: WebhookContext,
  ) {}

  async check(): Promise<ProvisioningStatus> {
    const [robot, event, signerField, webhooks] = await Promise.all([
      this.checkRobot(),
      this.checkEvent(),
      this.checkSignerField(),
      this.checkWebhooks(),
    ])
    return { robot, event, signerField, ...(webhooks && { webhooks }) }
  }

  async repair(): Promise<ProvisioningStatus> {
    const status = await this.check()

    if (status.robot === 'missing') {
      await this.client.callMethod(
        'bizproc.robot.add',
        buildClicksignRobotAddParams(),
      )
    }
    if (status.event === 'missing') {
      await this.client.callMethod('event.bind', {
        event: 'onCrmTimelineItemAction',
        handler: `${env.apiUrl}${CLICKSIGN_CANCEL_HANDLER_PATH}`,
      })
    }
    if (status.signerField === 'missing') {
      await this.client.callMethod(
        'crm.contact.userfield.add',
        buildSignerPartFieldParams(),
      )
    }

    await this.repairWebhooks()

    return this.check()
  }

  private async checkWebhooks(): Promise<WebhookCheck[] | undefined> {
    if (!this.webhookCtx) return undefined
    const tokens = await this.loadTokens()
    return Promise.all(
      tokens.map(async token => ({
        token: typeof token.name === 'string' ? token.name : token.token,
        status: await this.checkWebhookToken(token),
      })),
    )
  }

  private async checkWebhookToken(
    token: ProvisionableToken,
  ): Promise<CheckStatus> {
    const url = token.webhook?.url
    if (!url || !token.webhook?.id) return 'missing'
    try {
      const hooks = await new ClicksignClient(token.ambiente).listWebhooks(
        token.token,
      )
      return hooks.some(h => h.endpoint === url) ? 'ok' : 'missing'
    } catch (error) {
      apiLogger.warn(
        { app: 'clicksign', err: safeErrorMessage(error) },
        'Check de webhook falhou',
      )
      return 'missing'
    }
  }

  // Re-registra os webhooks faltantes/divergentes (idempotente) e persiste o
  // secret de volta — mesma rotina do settings-save.
  private async repairWebhooks(): Promise<void> {
    if (!this.webhookCtx) return
    const { appId, settings } = this.webhookCtx
    const current = await settings.findByAppId(appId)
    const fields = current?.fields as {
      tokens?: ProvisionableToken[]
      [key: string]: unknown
    } | null
    const tokens = Array.isArray(fields?.tokens) ? fields.tokens : []
    if (tokens.length === 0) return

    const result = await new WebhookProvisioningService(appId).sync(tokens)
    if (result.changed) {
      await settings.upsertByAppId(appId, {
        fields: { ...fields, tokens: result.tokens },
      })
    }
  }

  private async loadTokens(): Promise<ProvisionableToken[]> {
    if (!this.webhookCtx) return []
    const current = await this.webhookCtx.settings.findByAppId(
      this.webhookCtx.appId,
    )
    const fields = current?.fields as { tokens?: ProvisionableToken[] } | null
    return Array.isArray(fields?.tokens) ? fields.tokens : []
  }

  private async checkRobot(): Promise<CheckStatus> {
    const res = await this.client.callMethod<{ result?: unknown }>(
      'bizproc.robot.list',
      {},
    )
    const codes = Array.isArray(res?.result) ? (res.result as string[]) : []
    return codes.includes(env.clicksign.robot.code) ? 'ok' : 'missing'
  }

  private async checkEvent(): Promise<CheckStatus> {
    const res = await this.client.callMethod<{
      result?: Array<{ event?: string }>
    }>('event.get', {})
    const events = Array.isArray(res?.result) ? res.result : []
    const bound = events.some(
      e => (e.event ?? '').toLowerCase() === CANCEL_EVENT,
    )
    return bound ? 'ok' : 'missing'
  }

  private async checkSignerField(): Promise<CheckStatus> {
    const res = await this.client.callMethod<{
      result?: Array<{ FIELD_NAME?: string }>
    }>('crm.contact.userfield.list', {})
    const fields = Array.isArray(res?.result) ? res.result : []
    return fields.some(f => f.FIELD_NAME === SIGNER_PART_FIELD)
      ? 'ok'
      : 'missing'
  }
}
