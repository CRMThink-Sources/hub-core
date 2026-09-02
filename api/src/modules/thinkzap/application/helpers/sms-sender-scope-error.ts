import { isBitrixApiError } from '@/shared/infra/clients/bitrix-api.error'

/**
 * Códigos com que o Bitrix responde quando o app **não tem o escopo
 * `messageservice`**.
 *
 * `insufficient_scope` é a recusa direta. `ERROR_METHOD_NOT_FOUND` é a mesma coisa
 * vista de outro ângulo: sem o escopo concedido, os métodos `messageservice.*` nem
 * existem para aquele token, e o portal responde como se o método fosse desconhecido.
 *
 * Por **código**, nunca por trecho de mensagem: `error_description` é traduzida pelo
 * idioma do portal.
 */
const SCOPE_ERROR_CODES = new Set([
  'INSUFFICIENT_SCOPE',
  'ERROR_METHOD_NOT_FOUND',
])

/**
 * O escopo `messageservice` não está concedido no portal.
 *
 * Existe separado do erro genérico porque a causa é **externa ao cliente e à linha**:
 * o escopo é publicado no manifesto do app no Marketplace e só passa a valer depois
 * de o portal reautorizar. Um admin que lê "falha ao registrar o provedor" vai
 * investigar a linha, que está correta, e a credencial, que também está.
 */
export class MessageServiceScopeMissingError extends Error {
  constructor(readonly method: string) {
    super(
      'O portal não concedeu o escopo `messageservice` ao app. Publique o escopo no ' +
        'manifesto do aplicativo no Marketplace e peça a reautorização do portal — ' +
        'não é problema da linha nem da credencial.',
    )
    this.name = 'MessageServiceScopeMissingError'
  }
}

export function isMessageServiceScopeError(error: unknown): boolean {
  return (
    isBitrixApiError(error) && SCOPE_ERROR_CODES.has(error.code.toUpperCase())
  )
}

/**
 * Troca o erro cru do Bitrix pelo erro de escopo quando for o caso, e deixa qualquer
 * outro passar intacto — inclusive erro de rede e TLS, que não são `BitrixApiError`.
 */
export function rethrowAsScopeError(method: string, error: unknown): never {
  if (isMessageServiceScopeError(error)) {
    throw new MessageServiceScopeMissingError(method)
  }

  throw error
}
