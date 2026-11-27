import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import type { Request } from 'express'
import type {
  ListSends,
  ListSendsOutput,
} from '@/modules/thinkzap/application/list-sends'
import { ListSendsController } from './list-sends.controller'

const NOW = new Date('2026-11-27T12:00:00.000Z')

const output: ListSendsOutput = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  retentionDays: 90,
  lines: [],
  senders: [],
}

function makeSut() {
  const listSends = {
    execute: vi.fn<ListSends['execute']>().mockResolvedValue(output),
  }
  return {
    listSends,
    controller: new ListSendsController(listSends, () => NOW),
  }
}

const req = (
  query: Record<string, unknown>,
  over: { admin?: boolean; user?: string | null; domain?: string } = {},
) =>
  ({
    query,
    params: {},
    domainId: over.domain ?? 'domain-1',
    appId: 'crmthink.thinkzap',
    bitrixUserId: over.user === null ? undefined : (over.user ?? '7'),
    thinkzapAccess: { canManageAccess: over.admin ?? false },
  }) as unknown as Request

describe('ListSendsController', () => {
  it('devolve a saída do caso de uso em 200', async () => {
    const { controller } = makeSut()
    const response = await controller.perform(req({}))
    expect(response).toEqual({ status: 200, result: output })
  })

  it.each([
    ['page', '0'],
    ['page', '1e308'],
    ['page', '10001'],
    ['page', 'abc'],
    ['limit', '101'],
    ['limit', '0'],
    ['limit', '-5'],
    ['from', 'ontem'],
    ['to', '2026-02-31'],
  ])('%s=%s é 400 e não chama o caso de uso', async (key, value) => {
    const { controller, listSends } = makeSut()
    const response = await controller.perform(req({ [key]: value }))
    expect(response.status).toBe(400)
    expect(listSends.execute).not.toHaveBeenCalled()
  })

  it('status desconhecido é 400', async () => {
    const { controller, listSends } = makeSut()
    const response = await controller.perform(req({ status: 'XPTO' }))
    expect(response.status).toBe(400)
    expect(listSends.execute).not.toHaveBeenCalled()
  })

  it('a identidade vem do token: senderId/domainId da query não ampliam o escopo', async () => {
    const { controller, listSends } = makeSut()
    await controller.perform(
      req({ senderId: '99', domainId: 'outra', appCode: 'outro' }),
    )
    const input = listSends.execute.mock.calls[0]?.[0]
    expect(input).toMatchObject({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      bitrixUserId: '7',
      isAdmin: false,
    })
  })

  it('administrador chega ao caso de uso com isAdmin=true e o filtro de remetente', async () => {
    const { controller, listSends } = makeSut()
    await controller.perform(req({ senderId: '99' }, { admin: true }))
    const input = listSends.execute.mock.calls[0]?.[0]
    expect(input?.isAdmin).toBe(true)
    expect(input?.filters.senderId).toBe('99')
  })

  it('sem usuário no token e sem ser administrador é recusado', async () => {
    const { controller, listSends } = makeSut()
    const response = await controller.perform(req({}, { user: null }))
    expect(response.status).toBe(401)
    expect(listSends.execute).not.toHaveBeenCalled()
  })

  it('from só com data vira o início do dia e to só com data vira o fim do dia', async () => {
    const { controller, listSends } = makeSut()
    await controller.perform(req({ from: '2026-11-20', to: '2026-11-25' }))
    const filters = listSends.execute.mock.calls[0]?.[0].filters
    expect(filters?.from.toISOString()).toBe('2026-11-20T00:00:00.000Z')
    expect(filters?.to.toISOString()).toBe('2026-11-25T23:59:59.999Z')
  })

  it('data com horário passa como veio', async () => {
    const { controller, listSends } = makeSut()
    await controller.perform(
      req({ from: '2026-11-20T10:00:00.000Z', to: '2026-11-25T10:30:00.000Z' }),
    )
    const filters = listSends.execute.mock.calls[0]?.[0].filters
    expect(filters?.from.toISOString()).toBe('2026-11-20T10:00:00.000Z')
    expect(filters?.to.toISOString()).toBe('2026-11-25T10:30:00.000Z')
  })

  it('page e limit válidos chegam normalizados', async () => {
    const { controller, listSends } = makeSut()
    await controller.perform(req({ page: '3', limit: '50' }))
    const filters = listSends.execute.mock.calls[0]?.[0].filters
    expect(filters).toMatchObject({ page: 3, limit: 50 })
  })
})
