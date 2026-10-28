import { httpResponse } from '@/shared/helpers/http'
import { AdminAppNotFoundError } from '../application/helpers/resolve-admin-line'
import {
  PortalAppNotFoundError,
  ProviderEffectsDisabledError,
} from '../domain/errors/portal-domain.errors'
import {
  SubscriptionActionRefusedError,
  SubscriptionNotInAppError,
  SubscriptionPeriodEndError,
} from '../domain/errors/subscription-action.errors'

/**
 * Tradução HTTP dos erros das ações de escrita do backoffice (assinatura e provider).
 *
 * O `reason` vai no corpo de toda recusa: a tela traduz cada motivo, e um `409` sem
 * motivo obrigaria o front a adivinhar pela mensagem.
 *
 * `undefined` = não é erro desta família; quem chama re-lança.
 */
export function mapBackofficeActionError(
  error: unknown,
): httpResponse | undefined {
  if (error instanceof ProviderEffectsDisabledError) {
    return refusal(409, error.message, error.reason)
  }

  if (error instanceof SubscriptionActionRefusedError) {
    return refusal(409, error.message, error.reason)
  }

  if (error instanceof SubscriptionPeriodEndError) {
    return refusal(422, error.message, error.reason)
  }

  if (
    error instanceof SubscriptionNotInAppError ||
    error instanceof PortalAppNotFoundError ||
    error instanceof AdminAppNotFoundError
  ) {
    return { status: 404, result: { error: error.message } }
  }

  return undefined
}

const refusal = (
  status: number,
  message: string,
  reason: string,
): httpResponse => ({ status, result: { error: message, reason } })
