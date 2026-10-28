import { httpResponse } from '@/shared/helpers/http'
import { InvalidSmsSenderCodeError } from '@/modules/thinkzap/application/helpers/sms-sender-code'
import { MessageServiceScopeMissingError } from '@/modules/thinkzap/application/helpers/sms-sender-scope-error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { AdminAppNotFoundError } from '../application/helpers/resolve-admin-line'
import { ProviderEffectsDisabledError } from '../domain/errors/portal-domain.errors'

/**
 * Tradução HTTP dos erros de resolução de linha do portal admin.
 *
 * Uma função e não uma cópia em cada controller: as seis rotas de linha resolvem a
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

  /**
   * `422` pelo mesmo motivo: a linha existe, mas o id dela não cabe num `CODE` de
   * provedor de mensagem. Nada foi chamado no Bitrix.
   */
  if (error instanceof InvalidSmsSenderCodeError) {
    return { status: 422, result: { error: error.message } }
  }

  /**
   * Escopo ausente é `409`, não `502` nem `422`: nada está errado com a linha, com a
   * credencial nem com o Bitrix — falta um passo de publicação do app que ninguém
   * resolve tentando de novo. Um `5xx` mandaria o admin reexecutar a ação; a mensagem
   * nomeia o escopo e o que fazer.
   */
  if (error instanceof MessageServiceScopeMissingError) {
    return { status: 409, result: { error: error.message } }
  }

  /** Homologação: `409` com o motivo, como as demais ações de provider do backoffice. */
  if (error instanceof ProviderEffectsDisabledError) {
    return {
      status: 409,
      result: { error: error.message, reason: error.reason },
    }
  }

  return undefined
}
