import { httpResponse } from '@/shared/helpers/http'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { InvalidBitrixSubscriptionError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription.error'
import { InvalidBitrixSubscriptionItemError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription-item.error'
import { InvalidBitrixPlanError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-plan.error'
import { InvalidBitrixProductError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-product.error'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { ChannelAlreadyLinkedError } from '@/modules/thinkzap/domain/errors/channel-already-linked.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { MessageServiceScopeMissingError } from '@/modules/thinkzap/application/helpers/sms-sender-scope-error'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

// Falha de leitura de billing vira 502, nunca 404: a linha pode existir.
const isLineReadFailure = (error: unknown): boolean =>
  error instanceof BitrixError ||
  error instanceof InvalidBitrixSubscriptionError ||
  error instanceof InvalidBitrixSubscriptionItemError ||
  error instanceof InvalidBitrixPlanError ||
  error instanceof InvalidBitrixProductError

// Frágil: o ZApiClient lança Error sem tipo dedicado, então detecta pela mensagem.
const ZAPI_FAILURES = [
  'Failed to get instance data',
  'Failed to get instance status',
  'Failed to get QR code',
  'Failed to disconnect instance',
]

const isZApiFailure = (error: unknown): boolean =>
  error instanceof Error && ZAPI_FAILURES.includes(error.message)

// 402 e não 403 (403 = guard de permissão): a tela oferece contratar. `code` porque a mensagem é interpolada.
export function mapLineBlockedError(error: LineBlockedError): httpResponse {
  logThinkzapError(
    apiLogger,
    'thinkzap.line.blocked',
    { app: 'thinkzap', entitlement: error.entitlement, err: error },
    { level: 'warn' },
  )
  return {
    status: 402,
    result: {
      error: error.message,
      code: 'line-blocked',
      entitlement: error.entitlement,
    },
  }
}

export function mapLineError(
  error: unknown,
  fallbackMessage: string,
): httpResponse {
  // Item de outro cliente responde igual a inexistente, para não confirmar recurso alheio.
  if (error instanceof LineNotFoundError) {
    logThinkzapError(
      apiLogger,
      'thinkzap.subscription.line_not_found_for_item',
      { app: 'thinkzap', err: error },
      { level: 'warn' },
    )
    return { status: 404, result: { error: error.message } }
  }

  // Antes do provider/upstream: nada abaixo dá resposta melhor que "seu teste acabou".
  if (error instanceof LineBlockedError) {
    return mapLineBlockedError(error)
  }

  // Token válido de instalação que não existe mais.
  if (
    error instanceof CustomerNotFoundError ||
    error instanceof AplicationNotFoundError
  ) {
    logThinkzapError(
      apiLogger,
      'thinkzap.app.not_found',
      { app: 'thinkzap', err: error },
      { level: 'warn' },
    )
    return { status: 404, result: { error: error.message } }
  }

  // A mensagem já diz qual linha ocupa e o que fazer; a tela exibe direto.
  if (error instanceof ChannelAlreadyLinkedError) {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.channel_already_linked',
      {
        app: 'thinkzap',
        line: error.line,
        occupiedBySubscriptionItemId: error.occupiedBySubscriptionItemId,
        err: error,
      },
      { level: 'warn' },
    )
    return { status: 409, result: { error: error.message } }
  }

  // 409 e não 502: retentativa não resolve; `code` separa de falha de rede na tela.
  if (error instanceof MessageServiceScopeMissingError) {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.messageservice_scope_missing',
      { app: 'thinkzap', err: error },
      { level: 'warn' },
    )
    return {
      status: 409,
      result: {
        error: error.message,
        code: 'messageservice-scope-missing',
      },
    }
  }

  if (error instanceof LineProviderNotSupportedError) {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.provider_unsupported',
      { app: 'thinkzap', err: error },
      { level: 'warn' },
    )
    return { status: 400, result: { error: error.message } }
  }

  if (isLineReadFailure(error) || isZApiFailure(error)) {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.billing_read_failed',
      { app: 'thinkzap', err: error },
      { level: 'error', msg: fallbackMessage },
    )
    return {
      status: 502,
      result: {
        error: fallbackMessage,
        message: error instanceof Error ? error.message : undefined,
      },
    }
  }

  throw error
}
