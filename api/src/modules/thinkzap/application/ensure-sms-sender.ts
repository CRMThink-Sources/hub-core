import type { BitrixMethodCaller } from '@/shared/infra/clients/call-bitrix-idempotent'
import { isBitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { apiLogger } from '@/shared/infra/logger'
import {
  buildSmsSenderParams,
  buildTemplateSenderParams,
  type BuildSmsSenderParamsInput,
} from './build-sms-sender-params'
import { rethrowAsScopeError } from './helpers/sms-sender-scope-error'

export type EnsureSmsSenderResult = 'created' | 'updated' | 'skipped'

/**
 * Códigos e marcadores de "este `CODE` já está registrado neste portal".
 *
 * `messageservice.sender.add` não documenta o código do conflito, então a lista nasce
 * incompleta de propósito — mesma escolha de `callBitrixIdempotent`, e pela mesma
 * razão: o erro é logado com o código antes de ser classificado, então um código
 * faltando aparece nomeado no log e vira uma linha aqui.
 */
const ALREADY_EXISTS_CODES = new Set([
  'ERROR_SENDER_ALREADY_EXISTS',
  'ERROR_ALREADY_EXISTS',
])

const ALREADY_EXISTS_MARKERS = [
  'already exist',
  'already registered',
  'duplicate',
]

function isSenderAlreadyExistsError(error: unknown): boolean {
  if (!isBitrixApiError(error)) return false

  if (ALREADY_EXISTS_CODES.has(error.code.toUpperCase())) return true

  const text = `${error.description ?? ''} ${error.message}`.toLowerCase()

  return ALREADY_EXISTS_MARKERS.some(marker => text.includes(marker))
}

/**
 * Registra — ou converge — o provedor de mensagem de **uma linha** no portal do
 * cliente.
 *
 * Idempotente por construção: `messageservice.sender.add` e, no conflito de `CODE`,
 * `messageservice.sender.update`. Registrar duas vezes é o caso **normal** (linha
 * renomeada, handler mudou de host), e erro nesse caminho seria erro na operação mais
 * comum.
 *
 * O `update` leva o **corpo completo**, nunca parcial: a documentação do Bitrix não
 * garante preservar campo omitido, e perder o `HANDLER` transformaria as campanhas do
 * cliente em silêncio — a campanha dispararia, o provedor não receberia nada, e nada
 * na tela diria por quê.
 */
export type EnsureSmsSenderInput = BuildSmsSenderParamsInput & {
  /**
   * Presente = sender **de um template**, ausente = sender da linha.
   *
   * O mesmo `ensure` serve os dois porque o que muda entre eles é só o corpo: a
   * idempotência, a classificação de escopo e o no-op sem handler são idênticos, e
   * duplicar isso divergiria no dia em que um código de conflito novo aparecesse.
   */
  template?: {
    name: string
    language: string
    parameterCount: number
  }
}

export async function ensureSmsSender(
  client: BitrixMethodCaller,
  input: EnsureSmsSenderInput,
): Promise<EnsureSmsSenderResult> {
  const params = input.template
    ? buildTemplateSenderParams({
        item: input.item,
        templateName: input.template.name,
        language: input.template.language,
        parameterCount: input.template.parameterCount,
      })
    : buildSmsSenderParams(input)

  /**
   * Sem handler o provedor ficaria na lista de campanha do cliente apontando para
   * lugar nenhum: cada destinatário morreria em `404`, e a campanha inteira falharia
   * sem explicação. Mesmo mecanismo do robô de Bizproc, pela mesma razão.
   */
  if (!params.HANDLER) {
    return 'skipped'
  }

  apiLogger.info(
    { code: params.CODE, subscriptionItemId: input.item.id },
    'ensuring bitrix sms message provider',
  )

  try {
    await client.callMethod('messageservice.sender.add', params)

    return 'created'
  } catch (error) {
    if (!isSenderAlreadyExistsError(error)) {
      apiLogger.warn(
        {
          code: params.CODE,
          bitrixCode: isBitrixApiError(error) ? error.code : null,
          err: error,
        },
        'messageservice.sender.add failed',
      )

      rethrowAsScopeError('messageservice.sender.add', error)
    }
  }

  try {
    await client.callMethod('messageservice.sender.update', params)

    return 'updated'
  } catch (error) {
    rethrowAsScopeError('messageservice.sender.update', error)
  }
}
