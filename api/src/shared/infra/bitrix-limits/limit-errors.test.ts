import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { classifyLimitError, retryDelayMs } from './limit-errors'

const bitrixError = (status: number, body: unknown): AxiosError => {
  const error = new AxiosError('falhou')
  error.response = {
    status,
    statusText: '',
    data: body,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('classifyLimitError', () => {
  it('reconhece intensidade pelo código', () => {
    const hit = classifyLimitError(
      bitrixError(503, { error: 'QUERY_LIMIT_EXCEEDED' }),
    )

    expect(hit).toEqual({
      kind: 'query-limit',
      status: 503,
      code: 'QUERY_LIMIT_EXCEEDED',
    })
  })

  it('reconhece tempo de execução pelo código', () => {
    const hit = classifyLimitError(
      bitrixError(429, { error: 'OPERATION_TIME_LIMIT' }),
    )

    expect(hit?.kind).toBe('operation-time')
  })

  it('código em caixa baixa também casa', () => {
    expect(
      classifyLimitError(bitrixError(429, { error: 'operation_time_limit' }))
        ?.kind,
    ).toBe('operation-time')
  })

  it('503 sem corpo legível conta como intensidade', () => {
    const hit = classifyLimitError(bitrixError(503, '<html>gateway</html>'))

    expect(hit).toEqual({ kind: 'query-limit', status: 503, code: 'HTTP_503' })
  })

  it('erro de negócio do Bitrix não é limite', () => {
    expect(
      classifyLimitError(bitrixError(400, { error: 'CHAT_ID_EMPTY' })),
    ).toBeNull()
  })

  it('erro que não é do axios não é limite', () => {
    expect(classifyLimitError(new Error('socket hang up'))).toBeNull()
  })
})

describe('retryDelayMs', () => {
  const noJitter = { jitterRatio: 0 }

  it('cresce exponencialmente a partir da base', () => {
    expect(retryDelayMs(1, noJitter)).toBe(500)
    expect(retryDelayMs(2, noJitter)).toBe(1000)
    expect(retryDelayMs(3, noJitter)).toBe(2000)
    expect(retryDelayMs(4, noJitter)).toBe(4000)
  })

  it('respeita o teto', () => {
    expect(retryDelayMs(20, noJitter)).toBe(15_000)
  })

  it('o jitter mantém o atraso dentro da janela', () => {
    const low = retryDelayMs(3, { random: () => 0 })
    const high = retryDelayMs(3, { random: () => 1 })

    expect(low).toBe(1000)
    expect(high).toBe(2000)
  })

  it('jitter diferente para chamadas na mesma janela — é o que dessincroniza os workers', () => {
    const first = retryDelayMs(3, { random: () => 0.1 })
    const second = retryDelayMs(3, { random: () => 0.9 })

    expect(first).not.toBe(second)
  })
})
