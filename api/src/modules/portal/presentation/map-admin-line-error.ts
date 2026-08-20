import { httpResponse } from '@/shared/helpers/http'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { AdminAppNotFoundError } from '../application/helpers/resolve-admin-line'

/**
 * Tradução HTTP dos erros de resolução de linha do portal admin.
 *
 * Uma função e não uma cópia em cada controller: as quatro rotas de linha resolvem a
 * linha do mesmo jeito e falham do mesmo jeito, e é justamente aqui que uma divergência
 * passaria despercebida — item de outro cliente respondendo `422` numa rota e `404`
 * noutra vira vazamento de existência de recurso alheio.
 *
 * `undefined` = não é erro desta família; quem chama re-lança e deixa o `handle` do
 * `Controller` classificar.
 */
export function mapAdminLineError(error: unknown): httpResponse | undefined {
  /** Instalação inexistente e item fora da instalação são ambos `404`, de propósito. */
  if (
    error instanceof AdminAppNotFoundError ||
    error instanceof LineNotFoundError
  ) {
    return { status: 404, result: { error: error.message } }
  }

  /**
   * `422` e não `404`: o item existe, o que não se aplica é a operação — item de
   * cobrança sem conector, ou provider que não expõe aquela escrita.
   */
  if (error instanceof LineProviderNotSupportedError) {
    return { status: 422, result: { error: error.message } }
  }

  return undefined
}
