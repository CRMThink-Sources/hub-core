import { describe, expect, it } from 'vitest'
import { bitrixBool, parseBotEvent } from './bot-event'

const CODE = 'thinkzap-flow'

/** Evento como o webhook entrega: todo escalar em string (`http_build_query`). */
function messageEvent(over: {
  text?: string
  connector?: string
  isSystem?: string
  chatId?: string
  botCode?: string
}) {
  return {
    event: 'ONIMBOTV2MESSAGEADD',
    data: {
      bot: {
        id: '2060',
        code: over.botCode ?? CODE,
        auth: { domain: 'portal.bitrix24.com.br' },
      },
      message: {
        id: '789',
        chatId: over.chatId ?? '5',
        authorId: '31',
        text: over.text ?? 'oi',
        isSystem: over.isSystem ?? '0',
      },
      chat: { id: over.chatId ?? '5', dialogId: 'chat5', type: 'lines' },
      user: { id: '31', connector: over.connector ?? '1', bot: '0' },
      language: 'br',
    },
  }
}

describe('bitrixBool', () => {
  it('lê "0" do webhook como falso', () => {
    // `Boolean("0")` é `true`: com isso `user.connector: "0"` (operador interno) passaria
    // como contato e o bot responderia à mensagem do próprio atendente.
    expect(bitrixBool('0')).toBe(false)
    expect(bitrixBool('1')).toBe(true)
  })

  it('aceita também o booleano do modo FETCH', () => {
    expect(bitrixBool(false)).toBe(false)
    expect(bitrixBool(true)).toBe(true)
  })

  it('trata ausente e vazio como falso', () => {
    // `null` chega como `""` no webhook.
    expect(bitrixBool(undefined)).toBe(false)
    expect(bitrixBool('')).toBe(false)
  })
})

describe('parseBotEvent', () => {
  it('mensagem de contato externo avança o fluxo', () => {
    const parsed = parseBotEvent(
      messageEvent({ text: 'quero orçamento' }),
      CODE,
    )

    expect(parsed.kind).toBe('message')
    expect(parsed.chatId).toBe('5')
    expect(parsed.text).toBe('quero orçamento')
    expect(parsed.bitrixBotId).toBe(2060)
    expect(parsed.domain).toBe('portal.bitrix24.com.br')
  })

  it('ignora mensagem de quem não é contato', () => {
    // Operador humano escrevendo no mesmo chat: `connector: '0'`.
    const parsed = parseBotEvent(messageEvent({ connector: '0' }), CODE)

    expect(parsed.kind).toBe('ignore')
    expect(parsed.ignoreReason).toBe('autor-nao-e-contato')
  })

  it('ignora mensagem de sistema', () => {
    const parsed = parseBotEvent(messageEvent({ isSystem: '1' }), CODE)

    expect(parsed.ignoreReason).toBe('mensagem-de-sistema')
  })

  it('ignora anexo sem legenda', () => {
    // Mandar `''` para `advance` reprovaria a validação do nó como se o cliente tivesse
    // respondido errado, gastando tentativa.
    const parsed = parseBotEvent(messageEvent({ text: '   ' }), CODE)

    expect(parsed.ignoreReason).toBe('texto-vazio')
  })

  it('ignora evento de outro bot do mesmo app', () => {
    // `thinkzap-connector` é `type: supervisor` e não roda fluxo.
    const parsed = parseBotEvent(
      messageEvent({ botCode: 'thinkzap-connector' }),
      CODE,
    )

    expect(parsed.ignoreReason).toBe('bot-de-outro-code')
  })

  it('ignora evento que não tratamos', () => {
    const parsed = parseBotEvent(
      { event: 'ONIMBOTV2REACTIONCHANGE', data: { chat: { id: '5' } } },
      CODE,
    )

    expect(parsed.ignoreReason).toBe('evento-nao-tratado')
  })

  it('join começa o fluxo e não traz texto', () => {
    // `ONIMBOTV2JOINCHAT` não tem `message`: o shape é outro, com `dialogId`.
    const parsed = parseBotEvent(
      {
        event: 'ONIMBOTV2JOINCHAT',
        data: {
          bot: { id: '2060', code: CODE, auth: { domain: 'p.bitrix24.com' } },
          dialogId: 'chat5',
          chat: { id: '5', dialogId: 'chat5', type: 'lines' },
          user: { id: '31', connector: '1' },
        },
      },
      CODE,
    )

    expect(parsed.kind).toBe('join')
    expect(parsed.chatId).toBe('5')
    expect(parsed.text).toBe('')
  })

  it('lê o corpo achatado, sem o envelope data', () => {
    // O portal entrega `{event, data:{...}}` em parte dos casos e os campos na raiz em
    // outros. Ler só um lado dá 200 silencioso descartando a mensagem.
    const parsed = parseBotEvent(
      {
        event: 'ONIMBOTV2MESSAGEADD',
        bot: { id: '2060', code: CODE, auth: { domain: 'p.bitrix24.com' } },
        message: { chatId: '9', authorId: '31', text: 'oi', isSystem: '0' },
        chat: { id: '9' },
        user: { id: '31', connector: '1' },
      },
      CODE,
    )

    expect(parsed.kind).toBe('message')
    expect(parsed.chatId).toBe('9')
  })

  it('ignora evento sem chat id', () => {
    // Sem `CHAT_ID` não há como falar de volta: `bot.session.*` exige ele.
    const parsed = parseBotEvent(
      { event: 'ONIMBOTV2MESSAGEADD', data: { bot: { code: CODE } } },
      CODE,
    )

    expect(parsed.ignoreReason).toBe('sem-chat-id')
  })
})
