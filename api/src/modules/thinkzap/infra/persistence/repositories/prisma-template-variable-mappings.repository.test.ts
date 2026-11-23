import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, upsertMock, deleteManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
  deleteManyMock: vi.fn(),
}))

vi.mock('@/config/prisma.js', () => ({
  prisma: {
    thinkzapTemplateVariableMapping: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
      deleteMany: deleteManyMock,
    },
  },
}))

import { PrismaTemplateVariableMappingsRepository } from './prisma-template-variable-mappings.repository'

const scope = { domainId: 'dom-1', subscriptionItemId: 'item-1' }
const key = { name: 'promo', language: 'pt_BR' }
const unique = {
  domainId: 'dom-1',
  subscriptionItemId: 'item-1',
  templateName: 'promo',
  language: 'pt_BR',
  entityTypeId: 2,
}
const mappings = { '1': { source: 'contact' as const, fieldId: 'name' } }

describe('PrismaTemplateVariableMappingsRepository', () => {
  const repo = new PrismaTemplateVariableMappingsRepository()

  beforeEach(() => vi.clearAllMocks())

  it('find lê pela linha, nome, idioma e tipo de entidade', async () => {
    findUniqueMock.mockResolvedValue({ mappings })

    const result = await repo.find(scope, key, 2)

    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uq_template_variable_mapping: unique },
      }),
    )
    expect(result).toEqual(mappings)
  })

  it('find devolve null sem registro', async () => {
    findUniqueMock.mockResolvedValue(null)
    expect(await repo.find(scope, key, 2)).toBeNull()
  })

  it('upsert cria ou substitui o mapeamento do tipo', async () => {
    await repo.upsert(scope, key, 2, mappings)

    expect(upsertMock).toHaveBeenCalledWith({
      where: { uq_template_variable_mapping: unique },
      create: { ...unique, mappings },
      update: { mappings },
    })
  })

  it('delete remove só o tipo de entidade pedido', async () => {
    await repo.delete(scope, key, 3)

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { ...unique, entityTypeId: 3 },
    })
  })
})
