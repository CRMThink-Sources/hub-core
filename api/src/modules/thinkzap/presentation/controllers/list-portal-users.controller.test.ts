import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ListPortalUsersController } from './list-portal-users.controller'

type CallMethod = BitrixClient['callMethod']
/** Sem o genérico do `callMethod`, para o mock devolver a resposta crua. */
type RawCall = (
  method: string,
  params: Record<string, unknown>,
) => Promise<unknown>
const res = {} as Response

function build(callMethod: ReturnType<typeof vi.fn<RawCall>>) {
  return new ListPortalUsersController({
    callMethod: callMethod as CallMethod,
  } as BitrixClient)
}

const run = (
  controller: ListPortalUsersController,
  query: Record<string, string>,
) => controller.perform({ query } as unknown as Request, res)

describe('ListPortalUsersController', () => {
  it('busca por nome entre os ativos', async () => {
    const callMethod = vi.fn<RawCall>(() =>
      Promise.resolve({
        result: [
          { ID: 7, NAME: 'Ana', LAST_NAME: 'Lima', WORK_POSITION: ' SDR ' },
        ],
      }),
    )

    const out = await run(build(callMethod), { search: 'ana' })

    expect(callMethod).toHaveBeenCalledWith('user.get', {
      ACTIVE: true,
      NAME_SEARCH: 'ana',
    })
    expect(out.result).toEqual({
      users: [{ id: '7', name: 'Ana Lima', position: 'SDR' }],
      total: 1,
    })
  })

  it('por um id mantém o filtro de sempre', async () => {
    const callMethod = vi.fn<RawCall>(() => Promise.resolve({ result: [] }))

    await run(build(callMethod), { id: '7' })

    expect(callMethod).toHaveBeenCalledWith('user.get', { ID: '7' })
  })

  it('por vários ids pagina, inclui inativos e informa a situação', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => String(i + 1))
    const rows = ids.map(id => ({
      ID: id,
      NAME: `U${id}`,
      ACTIVE: id !== '60',
    }))
    const callMethod = vi
      .fn<CallMethod>()
      .mockResolvedValueOnce({ result: rows.slice(0, 50), next: 50 })
      .mockResolvedValueOnce({ result: rows.slice(50) })

    const out = await run(build(callMethod), { ids: ids.join(',') })

    expect(callMethod.mock.calls).toEqual([
      ['user.get', { FILTER: { ID: ids }, start: 0 }],
      ['user.get', { FILTER: { ID: ids }, start: 50 }],
    ])
    const { users } = out.result as {
      users: Array<{ id: string; active?: boolean }>
    }
    expect(users).toHaveLength(60)
    expect(users[0]).toEqual({ id: '1', name: 'U1', active: true })
    expect(users[59]).toEqual({ id: '60', name: 'U60', active: false })
  })

  it('ids vazios não consultam o portal', async () => {
    const callMethod = vi.fn<RawCall>()

    const out = await run(build(callMethod), { ids: ' , ' })

    expect(out.result).toEqual({ users: [], total: 0 })
    expect(callMethod).not.toHaveBeenCalled()
  })
})
