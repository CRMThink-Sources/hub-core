import { describe, expect, it, vi } from 'vitest'
import type {
  Department,
  DepartmentDirectory,
} from '@/modules/thinkzap/domain/ports/department-directory.port'
import { CachedDepartmentDirectory } from './cached-department-directory'

const MINUTE = 60_000
const old: Department[] = [{ id: '1', name: 'Empresa', parentId: null }]
const fresh: Department[] = [{ id: '2', name: 'Comercial', parentId: null }]

function build(list: ReturnType<typeof vi.fn<DepartmentDirectory['list']>>) {
  const clock = { now: 0 }
  const directory = new CachedDepartmentDirectory(
    { list },
    { now: () => clock.now },
  )
  return { directory, clock }
}

describe('CachedDepartmentDirectory', () => {
  it('dentro de 5 minutos não consulta de novo', async () => {
    const list = vi.fn<DepartmentDirectory['list']>().mockResolvedValue(old)
    const { directory, clock } = build(list)

    await directory.list('app-1')
    clock.now = 5 * MINUTE - 1

    expect(await directory.list('app-1')).toEqual(old)
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('aos 5 minutos consulta de novo', async () => {
    const list = vi
      .fn<DepartmentDirectory['list']>()
      .mockResolvedValueOnce(old)
      .mockResolvedValueOnce(fresh)
    const { directory, clock } = build(list)

    await directory.list('app-1')
    clock.now = 5 * MINUTE

    expect(await directory.list('app-1')).toEqual(fresh)
  })

  it('separa o cache por instalação', async () => {
    const list = vi.fn<DepartmentDirectory['list']>().mockResolvedValue(old)
    const { directory } = build(list)

    await directory.list('app-1')
    await directory.list('app-2')

    expect(list.mock.calls).toEqual([['app-1'], ['app-2']])
  })

  it('chamadas simultâneas compartilham uma busca', async () => {
    const list = vi.fn<DepartmentDirectory['list']>().mockResolvedValue(old)
    const { directory } = build(list)

    const results = await Promise.all([
      directory.list('app-1'),
      directory.list('app-1'),
    ])

    expect(results).toEqual([old, old])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('falha na atualização devolve a última lista conhecida', async () => {
    const list = vi
      .fn<DepartmentDirectory['list']>()
      .mockResolvedValueOnce(old)
      .mockRejectedValueOnce(new Error('Bitrix fora'))
      .mockResolvedValueOnce(fresh)
    const { directory, clock } = build(list)

    await directory.list('app-1')
    clock.now = 5 * MINUTE
    expect(await directory.list('app-1')).toEqual(old)
    // O valor vencido não vira novo: a próxima chamada tenta outra vez.
    expect(await directory.list('app-1')).toEqual(fresh)
  })

  it('falha sem lista conhecida propaga e não fica em cache', async () => {
    const boom = new Error('Bitrix fora')
    const list = vi
      .fn<DepartmentDirectory['list']>()
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce(fresh)
    const { directory } = build(list)

    await expect(directory.list('app-1')).rejects.toBe(boom)
    expect(await directory.list('app-1')).toEqual(fresh)
  })
})
