import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, findManyMock, upsertMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
  upsertMock: vi.fn(),
}))

vi.mock('@/config/prisma.js', () => ({
  prisma: {
    thinkzapTemplateDefault: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
      upsert: upsertMock,
    },
  },
}))

import { PrismaTemplateDefaultsRepository } from './prisma-template-defaults.repository'

const scope = { domainId: 'dom-1', subscriptionItemId: 'item-1' }
const uniqueKey = {
  uq_template_default: {
    domainId: 'dom-1',
    subscriptionItemId: 'item-1',
    templateName: 'promo',
    language: 'pt_BR',
  },
}

describe('PrismaTemplateDefaultsRepository', () => {
  const repo = new PrismaTemplateDefaultsRepository()

  beforeEach(() => vi.clearAllMocks())

  it('find devolve a imagem padrão pela linha, nome e idioma', async () => {
    findUniqueMock.mockResolvedValue({
      templateName: 'promo',
      language: 'pt_BR',
      headerImageUrl: 'https://cdn/a.png',
    })

    const result = await repo.find(scope, { name: 'promo', language: 'pt_BR' })

    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: uniqueKey }),
    )
    expect(result).toEqual({
      name: 'promo',
      language: 'pt_BR',
      headerImageUrl: 'https://cdn/a.png',
    })
  })

  it('find devolve null sem registro', async () => {
    findUniqueMock.mockResolvedValue(null)
    expect(
      await repo.find(scope, { name: 'promo', language: 'pt_BR' }),
    ).toBeNull()
  })

  it('findMany lista as imagens padrão da linha', async () => {
    findManyMock.mockResolvedValue([
      { templateName: 'a', language: 'pt_BR', headerImageUrl: 'https://x/a' },
      { templateName: 'b', language: 'en_US', headerImageUrl: 'https://x/b' },
    ])

    const result = await repo.findMany(scope)

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domainId: 'dom-1', subscriptionItemId: 'item-1' },
      }),
    )
    expect(result.map(r => r.name)).toEqual(['a', 'b'])
  })

  it('upsert cria ou substitui só a URL', async () => {
    await repo.upsert(scope, {
      name: 'promo',
      language: 'pt_BR',
      headerImageUrl: 'https://cdn/b.png',
    })

    expect(upsertMock).toHaveBeenCalledWith({
      where: uniqueKey,
      create: {
        domainId: 'dom-1',
        subscriptionItemId: 'item-1',
        templateName: 'promo',
        language: 'pt_BR',
        headerImageUrl: 'https://cdn/b.png',
      },
      update: { headerImageUrl: 'https://cdn/b.png' },
    })
  })
})
