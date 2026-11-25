import { describe, expect, it, vi } from 'vitest'
import { DepartmentsUnavailableError } from '@/modules/thinkzap/domain/errors/departments-unavailable.error'
import { LineNotAllowedError } from '@/modules/thinkzap/domain/errors/line-not-allowed.error'
import type {
  Department,
  DepartmentDirectory,
} from '@/modules/thinkzap/domain/ports/department-directory.port'
import type { AccessGroupRepository } from '@/modules/thinkzap/domain/repositories/access-group/access-group.repository'
import type { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { WidgetLineAccess } from './widget-line-access'

const scope = {
  appCode: 'thinkzap',
  domainId: 'd1',
  bitrixUserId: '7',
  bitrixDepartmentIds: [] as string[],
}
const inDepartment = { ...scope, bitrixDepartmentIds: ['30'] }

// Comercial (10) > Vendas (20) > SDR (30)
const tree: Department[] = [
  { id: '10', name: 'Comercial', parentId: null },
  { id: '20', name: 'Vendas', parentId: '10' },
  { id: '30', name: 'SDR', parentId: '20' },
]

function build(opts: {
  installed?: boolean
  hasGroups: boolean
  userLineIds?: string[]
  inherits?: boolean
  /** Linhas que só chegam pela herança (ancestrais informados). */
  inheritedLineIds?: string[]
  directoryDown?: boolean
}) {
  const getByAppCodeAndDomainId = vi.fn<
    GetInstalledAppRepository['getByAppCodeAndDomainId']
  >(() =>
    Promise.resolve(
      opts.installed === false ? null : ({ id: 'app-1' } as never),
    ),
  )
  const hasAny = vi.fn<AccessGroupRepository['hasAny']>(() =>
    Promise.resolve(opts.hasGroups),
  )
  const hasInheritingDepartments = vi.fn<
    AccessGroupRepository['hasInheritingDepartments']
  >(() => Promise.resolve(opts.inherits ?? false))
  const listLineIdsForUser = vi.fn<AccessGroupRepository['listLineIdsForUser']>(
    (_appId, membership) =>
      Promise.resolve([
        ...(opts.userLineIds ?? []),
        ...(membership.ancestorDepartmentIds.length > 0
          ? (opts.inheritedLineIds ?? [])
          : []),
      ]),
  )
  const list = vi.fn<DepartmentDirectory['list']>(() =>
    opts.directoryDown
      ? Promise.reject(new Error('Bitrix fora'))
      : Promise.resolve(tree),
  )
  const service = new WidgetLineAccess(
    { getByAppCodeAndDomainId },
    { hasAny, hasInheritingDepartments, listLineIdsForUser },
    { list },
  )
  return { service, hasAny, listLineIdsForUser, list }
}

describe('WidgetLineAccess', () => {
  it('sem grupos libera tudo e nem consulta as linhas do usuário', async () => {
    const { service, listLineIdsForUser, list } = build({ hasGroups: false })

    expect(await service.resolve(inDepartment)).toEqual({
      restricted: false,
      allowedLineIds: [],
    })
    expect(listLineIdsForUser).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
    await expect(
      service.assertCanUse({ ...scope, subscriptionItemId: '99' }),
    ).resolves.toBeUndefined()
  })

  it('com grupos devolve as linhas do usuário', async () => {
    const { service, listLineIdsForUser } = build({
      hasGroups: true,
      userLineIds: ['1', '2'],
    })

    expect(await service.resolve(scope)).toEqual({
      restricted: true,
      allowedLineIds: ['1', '2'],
    })
    expect(listLineIdsForUser).toHaveBeenCalledWith('app-1', {
      bitrixUserId: '7',
      departmentIds: [],
      ancestorDepartmentIds: [],
    })
  })

  it('recusa linha fora dos grupos do usuário', async () => {
    const { service } = build({ hasGroups: true, userLineIds: ['1'] })

    await expect(
      service.assertCanUse({ ...scope, subscriptionItemId: '3' }),
    ).rejects.toBeInstanceOf(LineNotAllowedError)
    await expect(
      service.assertCanUse({ ...scope, subscriptionItemId: '1' }),
    ).resolves.toBeUndefined()
  })

  it('usuário fora de qualquer grupo não usa linha nenhuma', async () => {
    const { service } = build({ hasGroups: true, userLineIds: [] })

    await expect(
      service.assertCanUse({ ...scope, subscriptionItemId: '1' }),
    ).rejects.toBeInstanceOf(LineNotAllowedError)
  })

  it('instalação não encontrada não restringe', async () => {
    const { service, hasAny } = build({ installed: false, hasGroups: true })

    expect((await service.resolve(scope)).restricted).toBe(false)
    expect(hasAny).not.toHaveBeenCalled()
  })

  it('sem vínculo com herança usa só a lotação direta, sem consultar o portal', async () => {
    const { service, listLineIdsForUser, list } = build({
      hasGroups: true,
      userLineIds: ['1'],
    })

    await service.resolve(inDepartment)

    expect(list).not.toHaveBeenCalled()
    expect(listLineIdsForUser).toHaveBeenCalledWith('app-1', {
      bitrixUserId: '7',
      departmentIds: ['30'],
      ancestorDepartmentIds: [],
    })
  })

  it('usuário sem lotação não consulta o portal mesmo com herança', async () => {
    const { service, list } = build({ hasGroups: true, inherits: true })

    await service.resolve(scope)

    expect(list).not.toHaveBeenCalled()
  })

  it('com herança informa os departamentos superiores ao repositório', async () => {
    const { service, listLineIdsForUser, list } = build({
      hasGroups: true,
      inherits: true,
      inheritedLineIds: ['5'],
    })

    expect((await service.resolve(inDepartment)).allowedLineIds).toEqual(['5'])
    expect(list).toHaveBeenCalledWith('app-1')
    expect(listLineIdsForUser).toHaveBeenCalledWith('app-1', {
      bitrixUserId: '7',
      departmentIds: ['30'],
      ancestorDepartmentIds: ['20', '10'],
    })
  })

  it('sem hierarquia, o acesso direto continua valendo', async () => {
    const { service } = build({
      hasGroups: true,
      inherits: true,
      directoryDown: true,
      userLineIds: ['1'],
      inheritedLineIds: ['5'],
    })

    await expect(
      service.assertCanUse({ ...inDepartment, subscriptionItemId: '1' }),
    ).resolves.toBeUndefined()
  })

  it('sem hierarquia, linha que dependeria dela avisa que não deu para verificar', async () => {
    const { service } = build({
      hasGroups: true,
      inherits: true,
      directoryDown: true,
      userLineIds: ['1'],
      inheritedLineIds: ['5'],
    })

    await expect(
      service.assertCanUse({ ...inDepartment, subscriptionItemId: '5' }),
    ).rejects.toBeInstanceOf(DepartmentsUnavailableError)
    // A lista para o seletor ficaria incompleta: melhor o erro que o widget já trata.
    await expect(service.resolve(inDepartment)).rejects.toBeInstanceOf(
      DepartmentsUnavailableError,
    )
  })
})
