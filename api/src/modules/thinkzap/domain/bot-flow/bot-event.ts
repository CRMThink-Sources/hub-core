// Leitura do evento `ONIMBOTV2*`. O Bitrix serializa o webhook com `http_build_query`,
// então todo escalar chega como string: `boolean` vira `"1"`/`"0"`, `null` vira `""`,
// `integer` vira `"789"`.

export type BotEventKind = 'join' | 'message' | 'ignore'

export type ParsedBotEvent = {
  kind: BotEventKind
  /** `CHAT_ID` das chamadas `imopenlines.bot.session.*`. */
  chatId: string
  /** `code` do bot no evento: um app pode ter mais de um bot registrado. */
  botCode: string
  bitrixBotId: number
  /** Domínio do portal — resolve a instalação. */
  domain: string
  /** Texto do contato. Vazio em `join`. */
  text: string
  authorId: string
  /** Por que foi ignorado, quando `kind === 'ignore'`. Para log, não para o cliente. */
  ignoreReason?:
    | 'evento-nao-tratado'
    | 'bot-de-outro-code'
    | 'autor-nao-e-contato'
    | 'mensagem-de-sistema'
    | 'sem-chat-id'
    | 'texto-vazio'
}

// Lê `"1"`/`"0"` do webhook e `true`/`false` do FETCH. `Boolean` não serve: `"0"` é string
// não-vazia e daria `true`, fazendo o bot tratar operador interno (`connector: "0"`) como
// contato do WhatsApp.
export function bitrixBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  // Só string é valor de verdade aqui; objeto é forma quebrada e vale como ausente.
  const texto = typeof value === 'string' ? value.trim() : ''
  return texto !== '' && texto !== '0' && texto.toLowerCase() !== 'n'
}

type Raw = Record<string, unknown>

function asRecord(value: unknown): Raw {
  return value && typeof value === 'object' ? (value as Raw) : {}
}

// `number` entra porque o FETCH manda id como inteiro enquanto o webhook manda string.
// Objeto vira `''`: `String({})` daria `'[object Object]'`, que passaria por id válido.
function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }
  return ''
}

// `expectedBotCode` vem de fora para o parser não conhecer a constante do registro.
export function parseBotEvent(
  body: unknown,
  expectedBotCode: string,
): ParsedBotEvent {
  const payload = asRecord(body)
  const evento = asText(payload.event).toUpperCase()

  // O corpo chega como `{event, data:{...}}` ou já com os campos do evento na raiz,
  // dependendo de como o portal entrega.
  const data = Object.keys(asRecord(payload.data)).length
    ? asRecord(payload.data)
    : payload

  const bot = asRecord(data.bot)
  const chat = asRecord(data.chat)
  const user = asRecord(data.user)
  const message = asRecord(data.message)
  const auth = asRecord(bot.auth)

  const base = {
    chatId: asText(chat.id ?? message.chatId ?? '').trim(),
    botCode: asText(bot.code),
    bitrixBotId: Number(asText(bot.id)) || 0,
    domain: asText(auth.domain || asRecord(payload.auth).domain),
    text: asText(message.text),
    authorId: asText(message.authorId ?? user.id ?? ''),
  }

  const ignorar = (reason: ParsedBotEvent['ignoreReason']): ParsedBotEvent => ({
    ...base,
    kind: 'ignore',
    ignoreReason: reason,
  })

  if (evento !== 'ONIMBOTV2JOINCHAT' && evento !== 'ONIMBOTV2MESSAGEADD') {
    return ignorar('evento-nao-tratado')
  }

  // Um app pode ter vários bots (o `thinkzap-connector`, por exemplo) com webhooks que
  // coincidem; só o bot deste fluxo pode rodá-lo.
  if (base.botCode && base.botCode !== expectedBotCode) {
    return ignorar('bot-de-outro-code')
  }

  if (!base.chatId) {
    return ignorar('sem-chat-id')
  }

  if (evento === 'ONIMBOTV2JOINCHAT') {
    return { ...base, kind: 'join', text: '' }
  }

  // `user.connector` distingue contato externo de operador interno: o atendente humano
  // entra no mesmo chat, e sem o filtro a fala dele faria o fluxo andar sozinho.
  if (!bitrixBool(user.connector)) {
    return ignorar('autor-nao-e-contato')
  }

  // Aviso de sistema do canal aberto ("sessão iniciada") não é fala do cliente.
  if (bitrixBool(message.isSystem)) {
    return ignorar('mensagem-de-sistema')
  }

  if (!base.text.trim()) {
    // Anexo sem legenda: mandar `''` gastaria uma tentativa do nó como se o cliente
    // tivesse errado. Ignorar mantém a pergunta em pé para a próxima mensagem.
    return ignorar('texto-vazio')
  }

  return { ...base, kind: 'message' }
}
