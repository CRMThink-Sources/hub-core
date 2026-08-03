/**
 * Erro devolvido pela REST do Bitrix com o **código** preservado.
 *
 * A mensagem do Bitrix (`error_description`) é localizada pelo idioma do portal
 * e não serve para decidir nada em código. O `code` (`error`) é estável, e é o
 * que `callBitrixIdempotent` usa para saber se um registro já existia.
 */
export class BitrixApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: string,
    readonly description: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'BitrixApiError'
  }
}

export function isBitrixApiError(error: unknown): error is BitrixApiError {
  return error instanceof BitrixApiError
}
