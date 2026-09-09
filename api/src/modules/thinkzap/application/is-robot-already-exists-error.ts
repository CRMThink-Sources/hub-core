import { isBitrixApiError } from '@/shared/infra/clients/bitrix-api.error'

/**
 * bizproc.robot.add não distingue "já existe" de erro de validação — as duas coisas
 * voltam com o mesmo código, ERROR_ACTIVITY_VALIDATION_FAILURE. Código primeiro, estável
 * entre idiomas; mensagem só como rede de segurança — error_description é traduzida pelo
 * idioma do portal e não cobre um portal fora de PT/EN.
 */
const ALREADY_EXISTS_CODES = new Set([
  'ERROR_ACTIVITY_ALREADY_INSTALLED',
  'ERROR_ACTIVITY_ALREADY_EXISTS',
  'ERROR_ACTIVITY_VALIDATION_FAILURE',
])

const MESSAGE_MARKERS = ['already', 'duplicate', 'validation_failure']

export function isRobotAlreadyExistsError(error: unknown): boolean {
  if (
    isBitrixApiError(error) &&
    ALREADY_EXISTS_CODES.has(error.code.toUpperCase())
  ) {
    return true
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error)

  return MESSAGE_MARKERS.some(marker => message.includes(marker))
}
