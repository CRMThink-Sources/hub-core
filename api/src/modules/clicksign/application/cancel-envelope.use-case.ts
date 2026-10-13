import type { ClickSignSettings } from '../domain/repositories/clicksign-settings.repository'
import { ClicksignClient } from '../infra/clients/clicksign.client'
import { ClicksignApiError } from '../infra/clients/clicksign-error'
import { logClicksignError } from '../errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { buildCancelActivityCard } from './build-activity-card'
import {
  ClicksignFields,
  ClicksignGroup,
  pickCode,
} from './clicksign-settings.types'
import type { BitrixCaller } from './provisioning.service'

export interface CancelEnvelopeInput {
  settings: ClickSignSettings
  bitrix: BitrixCaller
  documentKey: string
  dealId: string | number
  activityId: string | number
  originId: string
  apiToken: string
  logoUri?: string
  userId?: string | number
}

export class CancelEnvelopeUseCase {
  async execute(input: CancelEnvelopeInput): Promise<void> {
    const { settings, bitrix, dealId } = input

    const parsed = parseOriginId(input.originId)
    const envelopeKey = parsed.envelopeKey
    if (!envelopeKey) {
      logClicksignError(apiLogger, 'clicksign.document.envelope_missing', {
        app: 'clicksign',
        dealId,
      })
      await this.comment(
        bitrix,
        dealId,
        'Envelope não encontrado para cancelamento',
      )
      return
    }

    const fields = settings.fields as ClicksignFields | null
    const company = (fields?.tokens ?? []).find(t => t.token === input.apiToken)
    const clicksign = new ClicksignClient(company?.ambiente ?? 'prod')

    let canceled = false
    try {
      const res = await clicksign.cancelDocument(
        input.apiToken,
        envelopeKey,
        input.documentKey,
      )
      canceled = res.status === 'canceled'
    } catch (error) {
      logClicksignError(apiLogger, 'clicksign.document.cancel_failed', {
        dealId,
        envelopeKey,
        err: errorMessage(error),
      })
      await this.comment(
        bitrix,
        dealId,
        `Erro ao tentar cancelar documento: ${errorMessage(error)}`,
      )
      return
    }

    if (!canceled) {
      logClicksignError(apiLogger, 'clicksign.document.cancel_not_confirmed', {
        dealId,
        envelopeKey,
      })
      await this.comment(bitrix, dealId, 'Erro ao tentar cancelar documento')
      return
    }

    await bitrix.callMethod(
      'crm.activity.configurable.update',
      buildCancelActivityCard({
        activityId: input.activityId,
        dealId,
        documentKey: input.documentKey,
        originId: input.originId,
        logoUri: input.logoUri,
      }),
    )

    apiLogger.info(
      {
        app: 'clicksign',
        envelopeKey,
        documentKey: input.documentKey,
        dealId,
      },
      'Documento cancelado na Clicksign',
    )

    await this.logCancellation(input)

    const group = asArray<ClicksignGroup>(settings.groups).find(
      g => g.id === parsed.group,
    )
    const code = pickCode(group?.contato_assinado)
    if (code) {
      await bitrix.callMethod('crm.deal.update', {
        id: dealId,
        fields: { [code]: 'Documento cancelado' },
      })
    }
  }

  private async logCancellation(input: CancelEnvelopeInput): Promise<void> {
    let userName = ''
    if (input.userId != null) {
      const res = await input.bitrix.callMethod<{
        result?: Array<{ NAME?: string; LAST_NAME?: string }>
      }>('user.get', { ID: input.userId })
      const user = res.result?.[0]
      userName = `${user?.NAME ?? ''} ${user?.LAST_NAME ?? ''}`.trim()
    }
    const hora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    })
    await input.bitrix.callMethod('crm.timeline.logmessage.add', {
      fields: {
        entityTypeId: 2,
        entityId: input.dealId,
        title: '[Clicksign] Cancelamento de documento',
        text: `Cancelamento realizado por ${userName} em ${hora}`,
        iconCode: 'info',
      },
    })
  }

  private async comment(
    bitrix: BitrixCaller,
    dealId: string | number,
    message: string,
  ): Promise<void> {
    await bitrix.callMethod('crm.timeline.comment.add', {
      fields: { ENTITY_ID: dealId, ENTITY_TYPE: 'deal', COMMENT: message },
    })
  }
}

function parseOriginId(raw: string): { group?: string; envelopeKey?: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      group: typeof parsed.group === 'string' ? parsed.group : undefined,
      envelopeKey:
        typeof parsed.envelopeKey === 'string' ? parsed.envelopeKey : undefined,
    }
  } catch {
    return {}
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ClicksignApiError) return error.providerMessage
  if (error instanceof Error) return error.message
  return 'erro desconhecido'
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
