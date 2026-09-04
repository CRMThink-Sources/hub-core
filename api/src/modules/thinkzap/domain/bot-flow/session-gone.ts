/**
 * Reconhece "o bot não fala mais neste chat" nas respostas de `imopenlines.bot.session.*`.
 *
 * Existe porque o desfecho é o oposto do retry: o bot saiu da sessão (fechada, expirada,
 * assumida por operador) e nenhuma tentativa futura vai passar. Retentar só multiplica a
 * chamada e mantém a sessão `ACTIVE` no banco, prendendo o chat até o TTL.
 *
 * Duas formas de o Bitrix recusar, e a segunda é a que engana:
 *
 * - HTTP de erro, que virou exceção antes de chegar aqui;
 * - **HTTP 200 com `{ error }` no corpo**, que passa por sucesso em quem só olha o
 *   `catch`. Medido em produção (2026-08-18, portal `crmthinkers`, chat 9474):
 *   `200 { error: 'CANCELED', error_description: 'Você não pode enviar mensagens para o
 *   bate-papo especificado.' }` — o mesmo guard de escrita descrito em
 *   `postOpenChannelSystemNotice`.
 */

/** Corpo de `imopenlines.bot.session.*`: recusa vem com `error`, não com status. */
export type BotSessionResponse = {
  result?: unknown
  error?: unknown
  error_description?: unknown
}

/**
 * Por **código**, nunca por trecho da mensagem: `error_description` é traduzida pelo
 * idioma do portal, então casar substring quebraria num portal em russo.
 *
 * Lista explícita e curta de propósito. Errar para menos custa um retry inútil que já
 * acontece hoje; errar para mais encerraria uma sessão viva por causa de uma falha
 * passageira, e o cliente ficaria falando sozinho. Todo código não reconhecido é logado
 * com `code`, então um faltante aparece nomeado e vira uma linha aqui.
 */
const SESSION_GONE_CODES = new Set([
  // Guard de escrita no chat: o bot não é participante. Medido em produção.
  'CANCELED',
  'ACCESS_DENIED',
  'SESSION_NOT_FOUND',
  'CHAT_NOT_FOUND',
  'BOT_IS_NOT_CONNECTED',
])

function codeOf(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

/** O código cru da recusa, ou `''` quando a resposta foi aceita. */
export function sessionErrorCode(response: unknown): string {
  if (!response || typeof response !== 'object') return ''
  return codeOf((response as BotSessionResponse).error)
}

export function isSessionGoneCode(code: string): boolean {
  return SESSION_GONE_CODES.has(codeOf(code))
}

/**
 * Erro lançado quando o bot não participa mais do chat.
 *
 * Tipo próprio e não `BitrixError` porque quem chama precisa distinguir "não insista" de
 * "tente de novo": o worker converte isto em sessão encerrada, e qualquer outro erro em
 * retry.
 */
export class BotSessionGoneError extends Error {
  constructor(
    readonly method: string,
    readonly code: string,
    readonly chatId: string,
  ) {
    super(`Bitrix ${method}: bot fora da sessão do chat ${chatId} (${code})`)
    this.name = 'BotSessionGoneError'
  }
}

export function isBotSessionGoneError(
  error: unknown,
): error is BotSessionGoneError {
  return error instanceof BotSessionGoneError
}
