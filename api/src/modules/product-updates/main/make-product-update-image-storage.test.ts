import { describe, expect, it } from 'vitest'
import { R2ProductUpdateImageStorage } from '../infra/adapters/r2-product-update-image-storage.adapter'
import {
  makeProductUpdateImageStorage,
  makeProductUpdateImageUrlResolver,
} from './make-product-update-image-storage'

const complete = {
  accountId: 'acc',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'thinkzap-template-images',
  publicBaseUrl: 'https://imagens.loja.com',
}

describe('makeProductUpdateImageStorage', () => {
  it('monta o adapter R2 com as cinco variáveis', () => {
    expect(makeProductUpdateImageStorage(complete)).toBeInstanceOf(
      R2ProductUpdateImageStorage,
    )
  })

  it('reaproveita o adapter para a mesma configuração', () => {
    expect(makeProductUpdateImageStorage({ ...complete })).toBe(
      makeProductUpdateImageStorage({ ...complete }),
    )
  })

  it('ignora o bucket de anexos (outro uso do mesmo env.r2)', () => {
    expect(
      makeProductUpdateImageStorage({
        ...complete,
        outboundMediaBucket: '',
      } as typeof complete),
    ).toBeInstanceOf(R2ProductUpdateImageStorage)
  })

  it.each(Object.keys(complete))('null sem %s', key => {
    expect(
      makeProductUpdateImageStorage({ ...complete, [key]: ' ' }),
    ).toBeNull()
  })
})

describe('makeProductUpdateImageUrlResolver', () => {
  it('monta a URL pública a partir da chave', () => {
    const resolve = makeProductUpdateImageUrlResolver(
      'https://imagens.loja.com/',
    )

    expect(resolve('product-updates/a.png')).toBe(
      'https://imagens.loja.com/product-updates/a.png',
    )
    expect(resolve(null)).toBeNull()
  })

  it('sem domínio público não há URL', () => {
    expect(
      makeProductUpdateImageUrlResolver('')('product-updates/a.png'),
    ).toBeNull()
  })
})
