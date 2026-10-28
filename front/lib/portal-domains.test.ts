import { describe, expect, it } from 'vitest'
import { readPortalError } from './portal-domains'

describe('readPortalError', () => {
  it('lê status, motivo e ids do corpo da api', () => {
    const error = {
      response: {
        status: 409,
        data: {
          result: {
            error: 'Vincular espelho recusado: ambiguous',
            reason: 'ambiguous',
            ids: ['512', '900'],
          },
        },
      },
    }

    expect(readPortalError(error)).toEqual({
      status: 409,
      reason: 'ambiguous',
      ids: ['512', '900'],
      message: 'Vincular espelho recusado: ambiguous',
    })
  })

  it('erro sem resposta (rede) não lança', () => {
    expect(readPortalError(new Error('Network Error'))).toEqual({
      status: undefined,
      reason: undefined,
      ids: [],
      message: undefined,
    })
  })

  it('ignora ids que não são texto', () => {
    const error = {
      response: { status: 409, data: { result: { ids: [1, 'a'] } } },
    }

    expect(readPortalError(error).ids).toEqual(['a'])
  })
})
