import { httpResponse } from '@/shared/helpers/http'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { InvalidBitrixSubscriptionError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription.error'
import { InvalidBitrixSubscriptionItemError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription-item.error'
import { InvalidBitrixPlanError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-plan.error'
import { InvalidBitrixProductError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-product.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'

/**
 * Leitura de billing falhou: o Bitrix não respondeu, ou respondeu com shape que o
 * domínio não aceita. Vira `502`, nunca `404` — a linha pode existir.
 */
const isLineReadFailure = (error: unknown): boolean =>
  error instanceof BitrixError ||
  error instanceof InvalidBitrixSubscriptionError ||
  error instanceof InvalidBitrixSubscriptionItemError ||
  error instanceof InvalidBitrixPlanError ||
  error instanceof InvalidBitrixProductError

/**
 * Erro do provider Z-API. O `ZApiClient` lança `Error` com mensagem própria, sem
 * tipo dedicado, então a detecção é por mensagem — frágil, mas é o contrato atual
 * do client e trocá-lo é escopo dele, não desta superfície.
 */
const ZAPI_FAILURES = [
  'Failed to get instance data',
  'Failed to get instance status',
  'Failed to get QR code',
  'Failed to disconnect instance',
]

const isZApiFailure = (error: unknown): boolean =>
  error instanceof Error && ZAPI_FAILURES.includes(error.message)

/**
 * Tradução de erro para status nas rotas de linha (`/api/thinkzap/lines/*`).
 *
 * Compartilhado porque todas essas rotas passam pela mesma resolução e precisam
 * dar a mesma resposta para a mesma causa — `404` para linha fora do escopo do
 * token, `400` para provider incompatível, `502` para upstream fora.
 */
export function mapLineError(
  error: unknown,
  fallbackMessage: string,
): httpResponse {
  /**
   * Linha que não está na árvore da instalação do token. Também cobre o item de
   * outro cliente: indistinguível de inexistente de propósito, para não confirmar
   * a existência de recurso alheio.
   */
  if (error instanceof LineNotFoundError) {
    return { status: 404, result: { error: error.message } }
  }

  /** Token válido de instalação que não existe mais. */
  if (
    error instanceof CustomerNotFoundError ||
    error instanceof AplicationNotFoundError
  ) {
    return { status: 404, result: { error: error.message } }
  }

  /** Recurso existe, operação não se aplica. */
  if (error instanceof LineProviderNotSupportedError) {
    return { status: 400, result: { error: error.message } }
  }

  if (isLineReadFailure(error) || isZApiFailure(error)) {
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
