import { describe, expect, it } from 'vitest'
import { R2TemplateImageStorage } from '@/modules/thinkzap/infra/adapters/r2-template-image-storage.adapter'
import { makeTemplateImageStorage } from './make-template-image-storage'

const complete = {
  accountId: 'acc',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'thinkzap-template-images-staging',
  publicBaseUrl: 'https://imagens.loja.com',
}

describe('makeTemplateImageStorage', () => {
  it('monta o adapter R2 com as cinco variáveis', () => {
    expect(makeTemplateImageStorage(complete)).toBeInstanceOf(
      R2TemplateImageStorage,
    )
  })

  it('reaproveita o adapter para a mesma configuração', () => {
    expect(makeTemplateImageStorage(complete)).toBe(
      makeTemplateImageStorage(complete),
    )
  })

  it.each(Object.keys(complete))('null sem %s', key => {
    expect(makeTemplateImageStorage({ ...complete, [key]: ' ' })).toBeNull()
  })
})
