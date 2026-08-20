import { describe, expect, it } from 'vitest'
import {
  collectBitrixSpaProductToProduct,
  mapBitrixSpaProductToProduct,
} from './product.mapper'
import { InvalidBitrixProductError } from '../errors/invalid-bitrix-product.error'

/** Shape real da SPA 1134: `billingModel` vem como id numérico de enumeration. */
const validItem = {
  id: 1,
  title: 'Conector Oficial',
  ufCrm87BillingModel: 13607,
  ufCrm87Active: 'Y',
}

const itemWith = (overrides: Record<string, unknown>) => ({
  ...validItem,
  ...overrides,
})

describe('mapBitrixSpaProductToProduct', () => {
  it('mapeia um item válido da SPA', () => {
    expect(mapBitrixSpaProductToProduct(validItem)).toEqual({
      id: '1',
      name: 'Conector Oficial',
      billingModel: '13607',
      active: true,
    })
  })

  describe('billingModel', () => {
    it.each([
      [13605, '13605'],
      [13607, '13607'],
    ])('coage o id de enumeration %s para string', (raw, expected) => {
      expect(
        mapBitrixSpaProductToProduct(itemWith({ ufCrm87BillingModel: raw }))
          .billingModel,
      ).toBe(expected)
    })

    it('aceita o valor já como string', () => {
      expect(
        mapBitrixSpaProductToProduct(itemWith({ ufCrm87BillingModel: '13607' }))
          .billingModel,
      ).toBe('13607')
    })

    it('rejeita billingModel ausente', () => {
      const { ufCrm87BillingModel: _omitted, ...withoutModel } = validItem

      expect(() => mapBitrixSpaProductToProduct(withoutModel)).toThrow(
        InvalidBitrixProductError,
      )
    })

    it.each([null, ''])(
      'rejeita billingModel vazio (%s) em vez de coagir para texto',
      raw => {
        expect(() =>
          mapBitrixSpaProductToProduct(itemWith({ ufCrm87BillingModel: raw })),
        ).toThrow(InvalidBitrixProductError)
      },
    )
  })

  describe('campo ativo', () => {
    it.each([
      [true, true],
      ['Y', true],
      [false, false],
      ['N', false],
      [null, false],
    ])('trata %s como %s', (raw, expected) => {
      expect(
        mapBitrixSpaProductToProduct(itemWith({ ufCrm87Active: raw })).active,
      ).toBe(expected)
    })
  })

  it('rejeita title ausente, com o path no erro', () => {
    const { title: _omitted, ...withoutTitle } = validItem

    try {
      mapBitrixSpaProductToProduct(withoutTitle)
      throw new Error('esperava InvalidBitrixProductError')
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidBitrixProductError)
      const { issues } = error as InvalidBitrixProductError
      expect(issues.map(issue => issue.path.join('.'))).toContain('title')
    }
  })
})

describe('collectBitrixSpaProductToProduct', () => {
  it('mapeia a coleção inteira', () => {
    const products = collectBitrixSpaProductToProduct([
      validItem,
      itemWith({ id: 3, title: 'Conector não oficial' }),
    ])

    expect(products.map(product => product.id)).toEqual(['1', '3'])
  })

  it('propaga o erro de um item inválido em vez de omiti-lo', () => {
    expect(() =>
      collectBitrixSpaProductToProduct([
        validItem,
        itemWith({ title: undefined }),
      ]),
    ).toThrow(InvalidBitrixProductError)
  })
})
