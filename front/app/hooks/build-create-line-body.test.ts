import { describe, expect, it } from 'vitest'
import { buildCreateLineBody } from './use-line-subscription'

describe('buildCreateLineBody', () => {
  it('sem escolha, mantém o corpo de sempre', () => {
    expect(buildCreateLineBody('HUBMESSAGE', '8')).toEqual({
      provider: 'HUBMESSAGE',
      planId: '8',
    })
  })

  it('lista vazia não envia o campo', () => {
    expect(buildCreateLineBody('HUBMESSAGE', '8', [])).not.toHaveProperty(
      'includeLineIds',
    )
  })

  it('com linhas do teste escolhidas, envia os ids', () => {
    expect(buildCreateLineBody('HUBMESSAGE', '8', ['77'])).toEqual({
      provider: 'HUBMESSAGE',
      planId: '8',
      includeLineIds: ['77'],
    })
  })
})
