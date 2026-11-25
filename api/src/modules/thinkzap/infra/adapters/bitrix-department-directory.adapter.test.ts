import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixDepartmentDirectory } from './bitrix-department-directory.adapter'

type CallMethod = BitrixClient['callMethod']
/** Sem o genérico do `callMethod`, para o mock devolver a resposta crua. */
type RawCall = (
  method: string,
  params: Record<string, unknown>,
) => Promise<unknown>

function build(callMethod: ReturnType<typeof vi.fn<RawCall>>) {
  const clientFor = vi.fn((_installedAppId: string) =>
    Promise.resolve({ callMethod: callMethod as CallMethod }),
  )
  return { directory: new BitrixDepartmentDirectory(clientFor), clientFor }
}

describe('BitrixDepartmentDirectory', () => {
  it('junta todas as páginas e normaliza id, nome e pai', async () => {
    const callMethod = vi
      .fn<CallMethod>()
      .mockResolvedValueOnce({
        result: [{ ID: '1', NAME: 'Empresa' }],
        next: 50,
      })
      .mockResolvedValueOnce({
        result: [
          { ID: 2, NAME: ' Comercial ', PARENT: 1 },
          { ID: '3', PARENT: '2' },
        ],
      })
    const { directory, clientFor } = build(callMethod)

    expect(await directory.list('app-1')).toEqual([
      { id: '1', name: 'Empresa', parentId: null },
      { id: '2', name: 'Comercial', parentId: '1' },
      { id: '3', name: 'Departamento #3', parentId: '2' },
    ])
    expect(clientFor).toHaveBeenCalledWith('app-1')
    expect(callMethod.mock.calls).toEqual([
      ['department.get', { start: 0 }],
      ['department.get', { start: 50 }],
    ])
  })

  it('propaga a recusa do portal (ex.: escopo faltando)', async () => {
    const refusal = new Error('Bitrix error: 401 - insufficient_scope')
    const { directory } = build(vi.fn<RawCall>(() => Promise.reject(refusal)))

    await expect(directory.list('app-1')).rejects.toBe(refusal)
  })

  it('resposta sem lista é erro, não portal sem departamentos', async () => {
    const { directory } = build(
      vi.fn<RawCall>(() => Promise.resolve({ error: 'x' })),
    )

    await expect(directory.list('app-1')).rejects.toThrow('department.get')
  })
})
