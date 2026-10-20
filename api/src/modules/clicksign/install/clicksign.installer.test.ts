import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { BitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { ClicksignInstaller } from './clicksign.installer'
import { SIGNER_PART_FIELD } from '../application/build-signer-part-field-params'
import type { AppInstallContext } from '@/shared/domain/app-installer'

function makeContext(callMethod: ReturnType<typeof vi.fn>): AppInstallContext {
  return {
    client: { callMethod } as never,
    appCode: 'crmthink.clicksign2',
    installedAppId: 'app-2',
    spaItemId: '99',
    domain: 'acme.bitrix24.com.br',
    email: 'admin@acme.com',
    memberId: 'member-1',
  }
}

function methodsCalled(callMethod: ReturnType<typeof vi.fn>): string[] {
  return callMethod.mock.calls.map(call => call[0] as string)
}

/** `userfield.list` devolve os campos existentes; o resto é sucesso vazio. */
function clientWithFields(fields: Array<{ FIELD_NAME: string }>) {
  return vi.fn().mockImplementation((method: string): Promise<unknown> => {
    if (method === 'crm.contact.userfield.list') {
      return Promise.resolve({ result: fields })
    }
    return Promise.resolve({})
  })
}

describe('ClicksignInstaller', () => {
  let installer: ClicksignInstaller

  beforeEach(() => {
    installer = new ClicksignInstaller()
  })

  it('registra o robô e o evento de timeline', async () => {
    const callMethod = clientWithFields([])

    await installer.install(makeContext(callMethod))

    const methods = methodsCalled(callMethod)
    expect(methods).toContain('bizproc.robot.add')
    expect(methods).toContain('event.bind')

    const bind = callMethod.mock.calls.find(call => call[0] === 'event.bind')
    expect((bind?.[1] as { event: string }).event).toBe(
      'onCrmTimelineItemAction',
    )
  })

  it('cria o campo de parte signatária quando ele não existe', async () => {
    const callMethod = clientWithFields([{ FIELD_NAME: 'UF_CRM_OUTRO' }])

    await installer.install(makeContext(callMethod))

    expect(methodsCalled(callMethod)).toContain('crm.contact.userfield.add')
  })

  it('não recria o campo de parte signatária quando ele já existe', async () => {
    const callMethod = clientWithFields([{ FIELD_NAME: SIGNER_PART_FIELD }])

    await installer.install(makeContext(callMethod))

    expect(methodsCalled(callMethod)).not.toContain('crm.contact.userfield.add')
  })

  it('não aborta quando o robô já está instalado', async () => {
    const callMethod = vi
      .fn()
      .mockImplementation((method: string): Promise<unknown> => {
        if (method === 'crm.contact.userfield.list') {
          return Promise.resolve({ result: [] })
        }
        if (method === 'bizproc.robot.add') {
          return Promise.reject(
            new BitrixApiError(
              method,
              'ERROR_ACTIVITY_ALREADY_INSTALLED',
              'already',
              'Bitrix bizproc.robot.add: already',
            ),
          )
        }
        return Promise.resolve({})
      })

    await expect(
      installer.install(makeContext(callMethod)),
    ).resolves.toBeUndefined()
  })

  it('aborta em erro real e não segue para os passos seguintes', async () => {
    const callMethod = vi
      .fn()
      .mockImplementation((method: string): Promise<unknown> => {
        if (method === 'bizproc.robot.add') {
          return Promise.reject(
            new BitrixApiError(
              method,
              'ACCESS_DENIED',
              'Access denied!',
              'Bitrix bizproc.robot.add: Access denied!',
            ),
          )
        }
        return Promise.resolve({})
      })

    await expect(installer.install(makeContext(callMethod))).rejects.toThrow(
      'Access denied!',
    )
    expect(methodsCalled(callMethod)).not.toContain('event.bind')
  })
})
