import { createHmac, timingSafeEqual } from 'node:crypto'
import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { CLICKSIGN_HMAC_HEADER } from '../../clicksign.constants'
import { ClickSignSettingsRepository } from '../../domain/repositories/clicksign-settings.repository'
import { ClicksignFields } from '../../application/clicksign-settings.types'
import {
  HandleSignatureEventUseCase,
  WebhookPayload,
} from '../../application/handle-signature-event.use-case'
import { enqueueDocumentClosed } from '../../infra/queue/clicksign-document-closed.queue'
import { clicksignError, logClicksignError } from '../../errors/catalog'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { safeErrorMessage } from '../../infra/clients/clicksign-error'
import { apiLogger } from '@/shared/infra/logger'
import { setTenantLogContext } from '@/shared/infra/log-tenant'

// Raw body para validar o HMAC; tenant por `:appId`, conta/secret por `:ref`.
export class ClicksignWebhookController extends Controller {
  constructor(private readonly settings: ClickSignSettingsRepository) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = String(req.params.appId ?? '')
    const ref = String(req.params.ref ?? '')
    if (!appId || !ref)
      throw clicksignError('clicksign.webhook.missing_app_or_ref')

    await setTenantLogContext(appId)

    const settings = await this.settings.findByAppId(appId)
    if (!settings) throw clicksignError('clicksign.webhook.settings_not_found')

    const fields = settings.fields as ClicksignFields | null
    const account = (fields?.tokens ?? []).find(
      t => (t as { webhook?: { ref?: string } }).webhook?.ref === ref,
    ) as { webhook?: { secret?: string } } | undefined

    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}))

    // Sem secret não dá pra autenticar a origem → rejeita.
    const secret = account?.webhook?.secret
    if (!secret) throw clicksignError('clicksign.webhook.secret_missing')
    const signature = req.header(CLICKSIGN_HMAC_HEADER)
    if (!verifyHmac(rawBody, secret, signature)) {
      throw clicksignError('clicksign.webhook.signature_invalid')
    }

    const payload = parsePayload(rawBody)
    if (!payload) throw clicksignError('clicksign.webhook.payload_invalid')

    if (payload.event.name === 'document_closed') {
      await enqueueDocumentClosed({ appId, payload })
      return this.ok({ received: true })
    }

    const bitrix = await makeBitrixClientByAppId(appId)
    try {
      await new HandleSignatureEventUseCase(bitrix, settings).handle(payload)
    } catch (error) {
      // BitrixError cai no funil como 400 sem log.
      if (error instanceof BitrixError) {
        logClicksignError(apiLogger, 'clicksign.event.bitrix_update_failed', {
          app: 'clicksign',
          event: payload.event.name,
          documentKey: payload.document?.key,
          err: safeErrorMessage(error),
        })
      }
      throw error
    }

    return this.ok({ received: true })
  }
}

function parsePayload(rawBody: Buffer): WebhookPayload | null {
  try {
    // Clicksign manda { event, document } na raiz (não aninhado em `data`).
    const body = JSON.parse(rawBody.toString('utf8')) as WebhookPayload
    return body?.event?.name ? body : null
  } catch {
    return null
  }
}

function verifyHmac(
  rawBody: Buffer,
  secret: string,
  signature?: string,
): boolean {
  if (!signature) return false
  const received = signature.replace(/^sha256=/i, '').trim()
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(received, 'hex')
  const b = Buffer.from(expected, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
