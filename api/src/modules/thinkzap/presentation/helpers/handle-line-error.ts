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
 * Linha bloqueada, em qualquer superfície: ajustes, canal, QR code, grupos,
 * templates.
 *
 * **`402` e não `403`.** O `403` desta api significa "você não pode fazer isso" —
 * é o que o guard de permissão devolve. Linha bloqueada é outra coisa: o usuário
 * pode, a instalação é que não tem mais direito à linha. A tela precisa separar os
 * dois para oferecer contratar em vez de mandar falar com o administrador.
 *
 * O corpo carrega `code` e `entitlement` porque a mensagem é interpolada com o id
 * do item: comparar texto no front nunca casaria.
 *
 * Exportado e reusado pelas outras traduções de erro desta superfície — linha
 * bloqueada é um caso só, e responder diferente por rota faria a tela ter que
 * aprender cada uma.
 */
export function mapLineBlockedError(error: LineBlockedError): httpResponse {
  return {
    status: 402,
    result: {
      error: error.message,
      code: 'line-blocked',
      entitlement: error.entitlement,
    },
  }
}

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

  /**
   * Antes do provider e do upstream: a linha existe e o escopo já foi conferido,
   * então nada abaixo pode dar resposta melhor que "seu teste acabou".
   */
  if (error instanceof LineBlockedError) {
    return mapLineBlockedError(error)
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
