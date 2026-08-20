import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertMock } = vi.hoisted(() => ({ upsertMock: vi.fn() }))

vi.mock('@/config/prisma.js', () => ({
  prisma: { app: { upsert: upsertMock } },
}))

import { PrismaInstalledAppRepository } from './prisma-installed-app.repository'

const params = {
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
  email: 'novo@empresa.com',
}

const row = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
  email: 'novo@empresa.com',
  status: 'ACTIVE',
  installedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-30T00:00:00.000Z'),
}

describe('PrismaInstalledAppRepository.upsert', () => {
  beforeEach(() => upsertMock.mockReset())

  it('usa a restrição única (domain_id, app_code_id) como chave', async () => {
    upsertMock.mockResolvedValue(row)

    await new PrismaInstalledAppRepository().upsert(params)

    expect(
      (upsertMock.mock.calls[0]?.[0] as Record<string, unknown>).where,
    ).toEqual({
      domainId_appCodeId: {
        domainId: 'domain-1',
        appCodeId: 'crmthink.thinkzap',
      },
    })
  })

  it('cria com status ACTIVE', async () => {
    upsertMock.mockResolvedValue(row)

    await new PrismaInstalledAppRepository().upsert(params)

    expect(
      (upsertMock.mock.calls[0]?.[0] as Record<string, unknown>).create,
    ).toEqual(
      expect.objectContaining({
        domainId: 'domain-1',
        appCodeId: 'crmthink.thinkzap',
        email: 'novo@empresa.com',
        status: 'ACTIVE',
      }),
    )
  })

  it('atualiza email e reativa o app na reinstalação', async () => {
    upsertMock.mockResolvedValue(row)

    await new PrismaInstalledAppRepository().upsert(params)

    expect(
      (upsertMock.mock.calls[0]?.[0] as Record<string, unknown>).update,
    ).toEqual({
      email: 'novo@empresa.com',
      status: 'ACTIVE',
    })
  })

  it('não reescreve o id no update, preservando a instalação existente', async () => {
    upsertMock.mockResolvedValue(row)

    const result = await new PrismaInstalledAppRepository().upsert(params)

    expect(
      (upsertMock.mock.calls[0]?.[0] as Record<string, unknown>).update,
    ).not.toHaveProperty('id')
    expect(result.id).toBe('app-1')
  })
})
