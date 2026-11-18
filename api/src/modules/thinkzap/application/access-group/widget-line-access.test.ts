import { describe, expect, it, vi } from 'vitest'
import { LineNotAllowedError } from '@/modules/thinkzap/domain/errors/line-not-allowed.error'
import type { AccessGroupRepository } from '@/modules/thinkzap/domain/repositories/access-group/access-group.repository'
import type { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { WidgetLineAccess } from './widget-line-access'

const scope = { appCode: 'thinkzap', domainId: 'd1', bitrixUserId: '7' }

function build(opts: {
  installed?: boolean
  hasGroups: boolean
  userLineIds?: string[]
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
  const listLineIdsForUser = vi.fn<AccessGroupRepository['listLineIdsForUser']>(
    () => Promise.resolve(opts.userLineIds ?? []),
  )
  const service = new WidgetLineAccess(
    { getByAppCodeAndDomainId },
    { hasAny, listLineIdsForUser },
  )
  return { service, hasAny, listLineIdsForUser }
}

describe('WidgetLineAccess', () => {
  it('sem grupos libera tudo e nem consulta as linhas do usuário', async () => {
    const { service, listLineIdsForUser } = build({ hasGroups: false })

    expect(await service.resolve(scope)).toEqual({
      restricted: false,
      allowedLineIds: [],
    })
    expect(listLineIdsForUser).not.toHaveBeenCalled()
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
    expect(listLineIdsForUser).toHaveBeenCalledWith('app-1', '7')
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
})
