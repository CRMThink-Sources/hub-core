import { describe, expect, it } from 'vitest'
import {
  BotSessionGoneError,
  isBotSessionGoneError,
  isSessionGoneCode,
  sessionErrorCode,
} from './session-gone'

describe('sessionErrorCode', () => {
  it('lê o código do corpo recusado com HTTP 200', () => {
    // A recusa que engana: status de sucesso, `error` no corpo.
    expect(
      sessionErrorCode({
        error: 'CANCELED',
        error_description: 'Você não pode enviar mensagens para o bate-papo.',
      }),
    ).toBe('CANCELED')
  })

  it('resposta aceita não tem código', () => {
    expect(sessionErrorCode({ result: true })).toBe('')
    expect(sessionErrorCode({ result: 4021 })).toBe('')
  })

  it('normaliza caixa e espaço', () => {
    expect(sessionErrorCode({ error: ' canceled ' })).toBe('CANCELED')
  })

  it('forma inesperada não vira código', () => {
    expect(sessionErrorCode(null)).toBe('')
    expect(sessionErrorCode(undefined)).toBe('')
    expect(sessionErrorCode('CANCELED')).toBe('')
    expect(sessionErrorCode({ error: { code: 'CANCELED' } })).toBe('')
  })
})

describe('isSessionGoneCode', () => {
  it('reconhece o guard de escrita medido em produção', () => {
    expect(isSessionGoneCode('CANCELED')).toBe(true)
  })

  it('reconhece os demais códigos de bot fora da sessão', () => {
    for (const code of [
      'ACCESS_DENIED',
      'SESSION_NOT_FOUND',
      'CHAT_NOT_FOUND',
      'BOT_IS_NOT_CONNECTED',
    ]) {
      expect(isSessionGoneCode(code)).toBe(true)
    }
  })

  it('falha passageira não conta como sessão perdida', () => {
    // Errar para mais encerraria sessão viva: o cliente ficaria falando sozinho.
    expect(isSessionGoneCode('QUERY_LIMIT_EXCEEDED')).toBe(false)
    expect(isSessionGoneCode('OPERATION_TIME_LIMIT')).toBe(false)
    expect(isSessionGoneCode('')).toBe(false)
  })

  it('erro de parâmetro é bug nosso, não sessão perdida', () => {
    // `CHAT_ID_EMPTY` significa que mandamos payload errado — retentar não resolve, mas
    // encerrar a sessão esconderia o defeito.
    expect(isSessionGoneCode('CHAT_ID_EMPTY')).toBe(false)
  })
})

describe('BotSessionGoneError', () => {
  it('carrega código e chat para o log e a decisão', () => {
    const err = new BotSessionGoneError(
      'imopenlines.bot.session.message.send',
      'CANCELED',
      '9474',
    )

    expect(isBotSessionGoneError(err)).toBe(true)
    expect(err.code).toBe('CANCELED')
    expect(err.chatId).toBe('9474')
    expect(err.message).toContain('9474')
  })

  it('erro comum não é confundido com sessão perdida', () => {
    // O tipo é o que separa "não insista" de "tente de novo".
    expect(isBotSessionGoneError(new Error('CANCELED'))).toBe(false)
  })
})
