import { describe, expect, it, vi } from 'vitest'
import {
  AplicationPrismaClient,
  PrismaAplicationRepository,
} from './prisma-aplications.repository'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { AplicationTitleReader } from '@/modules/application/domain/repositories/aplication.repository'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  spaId: '512',
  status: 'ACTIVE',
  installedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  domain: {
    id: 'domain-1',
    name: 'acme.bitrix24.com.br',
    memberId: 'member-1',
  },
  appCode: {
    id: 'crmthink.thinkzap',
    code: 'local.6a070b9ee9dfb9',
    name: 'ThinkersZap',
  },
  ...overrides,
})

type AppRows = ReturnType<typeof row>

function makePrisma(rows: {
  findUnique?: AppRows | null
  findFirst?: AppRows | null
  findMany?: AppRows[]
  update?: AppRows
}) {
  const findUnique = vi.fn(() => Promise.resolve(rows.findUnique ?? null))
  const findFirst = vi.fn(() => Promise.resolve(rows.findFirst ?? null))
  const findMany = vi.fn(() => Promise.resolve(rows.findMany ?? []))
  const update = vi.fn(() => Promise.resolve(rows.update ?? row()))

  const prisma = {
    app: { findUnique, findFirst, findMany, update },
  } as unknown as AplicationPrismaClient

  return { prisma, findUnique, findFirst, findMany, update }
}

function makeTitles(entries: Record<string, string> = { '512': 'SPA — Acme' }) {
  const getTitlesBySpaIds = vi.fn(() =>
    Promise.resolve(new Map(Object.entries(entries))),
  )

  const reader: AplicationTitleReader = { getTitlesBySpaIds }

  return { reader, getTitlesBySpaIds }
}

describe('PrismaAplicationRepository', () => {
  describe('getAplication', () => {
    it('hidrata cliente, appCode, título e datas', async () => {
      const { prisma } = makePrisma({ findUnique: row() })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplication('app-1')

      expect(aplication).toEqual({
        id: 'app-1',
        spaId: '512',
        customer: {
          id: 'domain-1',
          name: 'acme.bitrix24.com.br',
          memberId: 'member-1',
        },
        appCode: 'crmthink.thinkzap',
        title: 'SPA — Acme',
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      })
    })

    it('lança AplicationNotFoundError quando não há linha', async () => {
      const { prisma } = makePrisma({ findUnique: null })
      const titles = makeTitles()

      await expect(
        new PrismaAplicationRepository(prisma, titles.reader).getAplication(
          'ausente',
        ),
      ).rejects.toThrow(AplicationNotFoundError)
    })

    it.each([['SUSPENDED'], ['REMOVED'], ['INACTIVE']])(
      'traduz status %s para active: false',
      async status => {
        const { prisma } = makePrisma({ findUnique: row({ status }) })
        const titles = makeTitles()

        const aplication = await new PrismaAplicationRepository(
          prisma,
          titles.reader,
        ).getAplication('app-1')

        expect(aplication.active).toBe(false)
      },
    )
  })

  describe('título', () => {
    it('usa o nome do app quando não há espelho, sem chamar o reader', async () => {
      const { prisma } = makePrisma({ findUnique: row({ spaId: null }) })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplication('app-1')

      expect(aplication.title).toBe('ThinkersZap')
      expect(titles.getTitlesBySpaIds).not.toHaveBeenCalled()
    })

    it('usa o nome do app quando o item da SPA não devolve título', async () => {
      const { prisma } = makePrisma({ findUnique: row() })
      const titles = makeTitles({})

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplication('app-1')

      expect(aplication.title).toBe('ThinkersZap')
    })

    it('resolve a listagem inteira com uma única chamada ao reader', async () => {
      const { prisma } = makePrisma({
        findMany: [
          row(),
          row({ id: 'app-2', spaId: '900' }),
          row({ id: 'app-3', spaId: null }),
        ],
      })
      const titles = makeTitles({ '512': 'SPA — Acme', '900': 'SPA — GPT' })

      const aplications = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplicationsByCustomer('domain-1')

      expect(titles.getTitlesBySpaIds).toHaveBeenCalledTimes(1)
      expect(titles.getTitlesBySpaIds).toHaveBeenCalledWith(['512', '900'])
      expect(aplications.map(item => item.title)).toEqual([
        'SPA — Acme',
        'SPA — GPT',
        'ThinkersZap',
      ])
    })
  })

  describe('lookups', () => {
    it('resolve por spaId', async () => {
      const { prisma, findUnique } = makePrisma({ findUnique: row() })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplicationBySpaId('512')

      expect(aplication?.id).toBe('app-1')
      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { spaId: '512' } }),
      )
    })

    it('devolve null quando o spaId não tem instalação', async () => {
      const { prisma } = makePrisma({ findUnique: null })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplicationBySpaId('999')

      expect(aplication).toBeNull()
    })

    it('resolve por instalação consultando o banco, não a SPA', async () => {
      const { prisma, findFirst } = makePrisma({ findFirst: row() })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplicationByInstall({
        domain: 'acme.bitrix24.com.br',
        appCode: 'crmthink.thinkzap',
      })

      expect(aplication?.appCode).toBe('crmthink.thinkzap')
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            domain: { name: 'acme.bitrix24.com.br' },
            appCodeId: 'crmthink.thinkzap',
          },
        }),
      )
    })

    it('devolve null quando o par domínio + app code não existe', async () => {
      const { prisma } = makePrisma({ findFirst: null })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplicationByInstall({
        domain: 'outro.bitrix24.com.br',
        appCode: 'x',
      })

      expect(aplication).toBeNull()
    })

    it('lista as aplicações do cliente incluindo as inativas', async () => {
      const { prisma, findMany } = makePrisma({
        findMany: [
          row(),
          row({ id: 'app-2', spaId: '900', status: 'REMOVED' }),
        ],
      })
      const titles = makeTitles({ '512': 'A', '900': 'B' })

      const aplications = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplicationsByCustomer('domain-1')

      expect(aplications.map(item => item.active)).toEqual([true, false])
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { domainId: 'domain-1' } }),
      )
    })

    it('devolve lista vazia para cliente sem instalação', async () => {
      const { prisma } = makePrisma({ findMany: [] })
      const titles = makeTitles()

      const aplications = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).getAplicationsByCustomer('domain-sem-app')

      expect(aplications).toEqual([])
      expect(titles.getTitlesBySpaIds).not.toHaveBeenCalled()
    })
  })

  describe('linkSpaItem', () => {
    it('grava o spaId e devolve a entidade resultante', async () => {
      const { prisma, update } = makePrisma({
        findUnique: row({ spaId: null }),
        update: row({ spaId: '777' }),
      })
      const titles = makeTitles({ '777': 'SPA — Acme' })

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).linkSpaItem('app-1', '777')

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: { spaId: '777' },
        }),
      )
      expect(aplication.spaId).toBe('777')
    })

    it('lança AplicationNotFoundError sem tentar escrever', async () => {
      const { prisma, update } = makePrisma({ findUnique: null })
      const titles = makeTitles()

      await expect(
        new PrismaAplicationRepository(prisma, titles.reader).linkSpaItem(
          'ausente',
          '777',
        ),
      ).rejects.toThrow(AplicationNotFoundError)
      expect(update).not.toHaveBeenCalled()
    })

    it('propaga violação de unicidade quando o item já está vinculado', async () => {
      const findUnique = vi.fn(() => Promise.resolve(row({ spaId: null })))
      const update = vi.fn(() =>
        Promise.reject(new Error('Unique constraint failed on spa_id')),
      )
      const prisma = {
        app: { findUnique, update },
      } as unknown as AplicationPrismaClient
      const titles = makeTitles()

      await expect(
        new PrismaAplicationRepository(prisma, titles.reader).linkSpaItem(
          'app-1',
          '512',
        ),
      ).rejects.toThrow(/Unique constraint/)
    })
  })

  describe('unlinkSpaItem', () => {
    it('anula o spaId e devolve a entidade resultante', async () => {
      const { prisma, update } = makePrisma({
        findUnique: row(),
        update: row({ spaId: null }),
      })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).unlinkSpaItem('app-1')

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: { spaId: null },
        }),
      )
      expect(aplication.spaId).toBeNull()
      // Sem espelho o título cai para o nome do app, sem chamar o reader.
      expect(aplication.title).toBe('ThinkersZap')
    })

    it('não escreve quando o spaId já é nulo', async () => {
      const { prisma, update } = makePrisma({ findUnique: row({ spaId: null }) })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).unlinkSpaItem('app-1')

      expect(update).not.toHaveBeenCalled()
      expect(aplication.spaId).toBeNull()
    })

    it('lança AplicationNotFoundError sem tentar escrever', async () => {
      const { prisma, update } = makePrisma({ findUnique: null })
      const titles = makeTitles()

      await expect(
        new PrismaAplicationRepository(prisma, titles.reader).unlinkSpaItem(
          'ausente',
        ),
      ).rejects.toThrow(AplicationNotFoundError)
      expect(update).not.toHaveBeenCalled()
    })

    it('não altera status nem installedAt — só a coluna do espelho', async () => {
      const { prisma, update } = makePrisma({
        findUnique: row(),
        update: row({ spaId: null }),
      })
      const titles = makeTitles()

      const aplication = await new PrismaAplicationRepository(
        prisma,
        titles.reader,
      ).unlinkSpaItem('app-1')

      // `data` casa por igualdade profunda: qualquer campo a mais reprova.
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { spaId: null } }),
      )
      expect(aplication.active).toBe(true)
      expect(aplication.createdAt).toEqual(
        new Date('2026-01-01T00:00:00.000Z'),
      )
    })
  })
})
