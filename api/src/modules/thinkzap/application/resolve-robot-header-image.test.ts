import { describe, expect, it, vi } from 'vitest'
import { resolveRobotHeaderImage } from './resolve-robot-header-image'

const scope = {
  subscriptionItemId: 'item_1',
  domainId: 'domain_1',
  appCode: 'crmthink.thinkzap',
  name: 'promo',
  language: 'pt_BR',
}

const catalog = (type: string) =>
  vi
    .fn()
    .mockResolvedValue([{ name: 'promo', language: 'pt_BR', header: { type } }])

describe('resolveRobotHeaderImage', () => {
  it('template com imagem e URL https do negócio', async () => {
    expect(
      await resolveRobotHeaderImage(
        { ...scope, value: ' https://loja.com/produto-42.png ' },
        catalog('IMAGE'),
      ),
    ).toEqual({ headerImageUrl: 'https://loja.com/produto-42.png' })
  })

  it('template com imagem e campo vazio, sem imagem padrão', async () => {
    expect(
      await resolveRobotHeaderImage({ ...scope, value: '' }, catalog('IMAGE')),
    ).toEqual({ missing: true })
  })

  const withDefault = vi.fn().mockResolvedValue([
    {
      name: 'promo',
      language: 'pt_BR',
      header: { type: 'IMAGE', defaultImageUrl: 'https://cdn/padrao.png' },
    },
  ])

  it('campo vazio usa a imagem padrão do template', async () => {
    expect(
      await resolveRobotHeaderImage({ ...scope, value: ' ' }, withDefault),
    ).toEqual({ headerImageUrl: 'https://cdn/padrao.png' })
  })

  it('URL do negócio tem prioridade sobre a imagem padrão', async () => {
    expect(
      await resolveRobotHeaderImage(
        { ...scope, value: 'https://loja.com/b.png' },
        withDefault,
      ),
    ).toEqual({ headerImageUrl: 'https://loja.com/b.png' })
  })

  it('valor sem https é recusado mesmo com imagem padrão', async () => {
    expect(
      await resolveRobotHeaderImage(
        { ...scope, value: 'http://loja.com/b.png' },
        withDefault,
      ),
    ).toEqual({ missing: true })
  })

  it('template com imagem e URL sem https', async () => {
    expect(
      await resolveRobotHeaderImage(
        { ...scope, value: 'http://loja.com/a.png' },
        catalog('IMAGE'),
      ),
    ).toEqual({ missing: true })
  })

  it('template sem imagem ignora o valor', async () => {
    expect(
      await resolveRobotHeaderImage(
        { ...scope, value: 'https://loja.com/a.png' },
        catalog('NONE'),
      ),
    ).toEqual({})
  })

  it('template fora do catálogo envia sem imagem', async () => {
    expect(
      await resolveRobotHeaderImage(
        { ...scope, value: '' },
        vi.fn().mockResolvedValue([]),
      ),
    ).toEqual({})
  })

  it('catálogo indisponível não bloqueia o envio', async () => {
    const down = vi.fn().mockRejectedValue(new Error('502'))

    expect(
      await resolveRobotHeaderImage(
        { ...scope, value: 'https://loja.com/a.png' },
        down,
      ),
    ).toEqual({ headerImageUrl: 'https://loja.com/a.png' })
    expect(
      await resolveRobotHeaderImage({ ...scope, value: '' }, down),
    ).toEqual({})
  })
})
