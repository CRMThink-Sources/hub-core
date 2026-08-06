import { logger } from '@/shared/infra/logger'
import { isBitrixApiError } from './bitrix-api.error'

/**
 * Cliente mínimo que `callBitrixIdempotent` precisa. Estrutural de propósito:
 * `BitrixRestClient` satisfaz, e um dublê de teste também.
 */
export interface BitrixMethodCaller {
  callMethod(method: string, params: Record<string, unknown>): Promise<unknown>
}

/**
 * Códigos que significam "este registro já existe no portal".
 *
 * Por **código**, nunca por trecho da mensagem: `error_description` é traduzida
 * pelo idioma do portal, então casar substring quebraria num portal em russo.
 *
 * A lista nasce incompleta de propósito — os códigos do Bitrix para registro
 * preexistente não estão todos documentados. Todo erro passa por `logger.warn`
 * com `code` e `method` antes de ser classificado, então um código faltando
 * aparece nomeado no log e vira uma linha aqui. O custo de errar para menos é
 * uma reinstalação que falha com mensagem clara; para mais, seria engolir falha
 * real — por isso a lista é explícita e não uma heurística.
 */
export const IDEMPOTENT_ERROR_CODES = new Set([
  // event.bind
  'ERROR_EVENT_BINDING_EXISTS',
  'ERROR_HANDLER_ALREADY_BINDED',
  // placement.bind
  'ERROR_PLACEMENT_ALREADY_BINDED',
  'ERROR_PLACEMENT_ALREADY_BOUND',
  // bizproc.robot.add
  'ERROR_ACTIVITY_ALREADY_INSTALLED',
  'ERROR_ACTIVITY_ALREADY_EXISTS',
  // imconnector.register
  'ERROR_CONNECTOR_ALREADY_EXISTS',
  'CONNECTOR_ALREADY_EXIST',
  // crm.*.userfield.add
  'ERROR_FIELD_ALREADY_EXISTS',
])

/**
 * Rede de segurança para quando o código do erro não está na lista.
 *
 * Casar mensagem é pior que casar código — `error_description` é traduzida pelo
 * idioma do portal, então isto **não** cobre um portal em russo. Existe porque a
 * alternativa é pior: instalação abortando em portal já configurado, que foi o
 * que aconteceu com `event.bind` ("Handler already binded") quando a lista de
 * códigos era só palpite. Os installers reconciliam por estado (`event.get`,
 * `placement.get`) justamente para não depender disto — aqui é o último recurso.
 */
const IDEMPOTENT_MESSAGE_MARKERS = [
  'already binded',
  'already bound',
  'already exist',
  'already installed',
  'duplicate',
]

function idempotentCodeOf(error: unknown): string | null {
  if (!isBitrixApiError(error)) return null

  const code = error.code.toUpperCase()
  if (IDEMPOTENT_ERROR_CODES.has(code)) return code

  const text = `${error.description ?? ''} ${error.message}`.toLowerCase()

  return IDEMPOTENT_MESSAGE_MARKERS.some(marker => text.includes(marker))
    ? code
    : null
}

/**
 * Executa um registro no portal do Bitrix tratando "já existe" como sucesso.
 *
 * É o que permite a instalação ser fail-fast sem quebrar reinstalação: num
 * portal já configurado, `imconnector.register`, `event.bind`, `placement.bind`
 * e `bizproc.robot.add` erram, e esse erro não é uma falha de instalação.
 *
 * Qualquer outro erro propaga — inclusive erro de rede e TLS, que não são
 * `BitrixApiError` e portanto nunca são classificados como idempotentes.
 */
export async function callBitrixIdempotent(
  client: BitrixMethodCaller,
  method: string,
  params: Record<string, unknown>,
): Promise<void> {
  try {
    await client.callMethod(method, params)
  } catch (error) {
    const code = isBitrixApiError(error) ? error.code : null

    // Antes de decidir: o log nomeia o código, então um código ausente da lista
    // é diagnosticável em produção sem reproduzir o erro.
    logger.warn({ method, code, err: error }, 'bitrix install call failed')

    const idempotentCode = idempotentCodeOf(error)
    if (!idempotentCode) throw error

    logger.info(
      { method, code: idempotentCode },
      'bitrix install call already applied, skipping',
    )
  }
}
