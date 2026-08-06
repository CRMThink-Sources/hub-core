import { describe, expect, it } from 'vitest'
import { isLineDisconnectedError } from './extract-line-disconnected'

/** Erro do axios como o `axiosThinkzap` o rejeita: cru, com `response` intacto. */
const axiosError = (status: number, result: unknown) => ({
  response: { status, data: { result, traceId: 't-1', time: 3 } },
  message: 'Request failed with status code ' + String(status),
})

describe('isLineDisconnectedError', () => {
  it('reconhece a recusa por linha desconectada', () => {
    const err = axiosError(409, {
      error: 'Linha "i1" não está conectada',
      code: 'line-disconnected',
    })

    expect(isLineDisconnectedError(err)).toBe(true)
  })

  /**
   * O ponto do helper: `402` é linha sem direito (contratar), `409` é linha
   * desconectada (reconectar). Tratar os dois igual daria a instrução errada.
   */
  it('NÃO reconhece 402 de linha bloqueada', () => {
    const err = axiosError(402, {
      error: 'Linha "i1" não tem assinatura ativa',
      code: 'line-blocked',
      entitlement: 'inactive',
    })

    expect(isLineDisconnectedError(err)).toBe(false)
  })

  /** A discriminação é pelo `code`: a mensagem é interpolada com o id do item. */
  it('exige o code, não só o status', () => {
    const err = axiosError(409, { error: 'Conflito' })

    expect(isLineDisconnectedError(err)).toBe(false)
  })

  it('não reconhece 400 com a mensagem crua do provider', () => {
    const err = axiosError(400, { error: 'Failed to send message' })

    expect(isLineDisconnectedError(err)).toBe(false)
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['Error comum', new Error('Network error')],
    ['objeto sem response', { message: 'boom' }],
    ['response sem data', { response: { status: 409 } }],
  ])('devolve false para %s', (_label, err) => {
    expect(isLineDisconnectedError(err)).toBe(false)
  })
})
