import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncRobotConnectorsMock, listSpaEntityTypesMock } = vi.hoisted(() => ({
  syncRobotConnectorsMock: vi.fn(),
  listSpaEntityTypesMock: vi.fn(),
}))

vi.mock('../application/sync-robot-connectors', () => ({
  syncThinkzapRobotConnectorOptions: syncRobotConnectorsMock,
}))

vi.mock('../application/list-spa-entity-types', () => ({
  listSpaEntityTypes: listSpaEntityTypesMock,
}))

vi.mock('@/shared/infra/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/config/env', () => ({
  env: {
    bitrix: {
      webhookUrl: 'https://api.test/webhooks/bitrix',
      connector: {
        code: 'hubthink_thinkzap',
        name: 'ThinkZap',
        url: 'https://app.test/connector',
      },
      iframeAudio: { code: 'a', name: 'a', url: '', hash: '' },
      placement: { name: 'ThinkZap', url: 'https://app.test/placement' },
      robot: { code: 'r', name: 'r', handlerUrl: 'https://api.test/robot' },
    },
    apiUrl: 'https://api.test',
  },
}))

import { BitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { ThinkzapInstaller } from './thinkzap.installer'
import type { AppInstallContext } from '@/shared/domain/app-installer'

function makeContext(callMethod: ReturnType<typeof vi.fn>): AppInstallContext {
  return {
    client: { callMethod } as never,
    appCode: 'crmthink.thinkzap',
    installedAppId: 'app-1',
    spaItemId: '4242',
    domain: 'acme.bitrix24.com.br',
    email: 'admin@acme.com',
    memberId: 'member-1',
  }
}

function methodsCalled(callMethod: ReturnType<typeof vi.fn>): string[] {
  return callMethod.mock.calls.map(call => call[0] as string)
}

describe('ThinkzapInstaller', () => {
  beforeEach(() => {
    syncRobotConnectorsMock.mockReset().mockResolvedValue(undefined)
    listSpaEntityTypesMock.mockReset().mockResolvedValue([])
  })

  it('lê o estado do portal antes de registrar eventos, conector, placements e robô', async () => {
    const callMethod = vi.fn().mockResolvedValue({})

    await new ThinkzapInstaller().install(makeContext(callMethod))

    const methods = methodsCalled(callMethod)
    expect(methods[0]).toBe('event.get')
    expect(methods.slice(1, 4)).toEqual([
      'event.bind',
      'event.bind',
      'event.bind',
    ])
    expect(methods[4]).toBe('imconnector.register')
    expect(methods).toContain('placement.get')
    expect(methods).toContain('placement.bind')
    expect(methods).toContain('bizproc.robot.add')
  })

  it('vincula os três eventos de mensagem do conector', async () => {
    const callMethod = vi.fn().mockResolvedValue({})

    await new ThinkzapInstaller().install(makeContext(callMethod))

    const events = callMethod.mock.calls
      .filter(call => call[0] === 'event.bind')
      .map(call => (call[1] as { event: string }).event)

    expect(events).toEqual([
      'ONIMCONNECTORMESSAGEADD',
      'ONIMCONNECTORMESSAGEUPDATE',
      'ONIMCONNECTORMESSAGEDELETE',
    ])
  })

  it('sincroniza as opções do robô com o id da instalação, no fim', async () => {
    const callMethod = vi.fn().mockResolvedValue({})

    await new ThinkzapInstaller().install(makeContext(callMethod))

    expect(syncRobotConnectorsMock).toHaveBeenCalledWith('app-1')
  })

  it('não aborta quando o registro já existe no portal', async () => {
    const callMethod = vi.fn().mockImplementation((method: string) => {
      if (method !== 'imconnector.register') return Promise.resolve({})
      return Promise.reject(
        new BitrixApiError(
          method,
          'ERROR_CONNECTOR_ALREADY_EXISTS',
          'exists',
          'x',
        ),
      )
    })

    await expect(
      new ThinkzapInstaller().install(makeContext(callMethod)),
    ).resolves.toBeUndefined()
    expect(syncRobotConnectorsMock).toHaveBeenCalled()
  })

  it('aborta em erro real e não segue para os passos seguintes', async () => {
    const callMethod = vi.fn().mockImplementation((method: string) => {
      if (method !== 'imconnector.register') return Promise.resolve({})
      return Promise.reject(
        new BitrixApiError(
          method,
          'ACCESS_DENIED',
          'Access denied!',
          'Bitrix imconnector.register: Access denied!',
        ),
      )
    })

    await expect(
      new ThinkzapInstaller().install(makeContext(callMethod)),
    ).rejects.toThrow('Access denied!')
    expect(methodsCalled(callMethod)).not.toContain('bizproc.robot.add')
    expect(syncRobotConnectorsMock).not.toHaveBeenCalled()
  })

  it('aborta quando uma SPA falha por motivo real, nomeando o placement', async () => {
    listSpaEntityTypesMock.mockResolvedValue([1050])
    const callMethod = vi
      .fn()
      .mockImplementation(
        (method: string, params: Record<string, unknown>): Promise<unknown> => {
          const placement = params.PLACEMENT as string | undefined
          if (method === 'placement.bind' && placement?.includes('1050')) {
            return Promise.reject(
              new BitrixApiError(
                method,
                'ACCESS_DENIED',
                'Access denied!',
                'Bitrix placement.bind: Access denied!',
              ),
            )
          }
          return Promise.resolve({})
        },
      )

    await expect(
      new ThinkzapInstaller().install(makeContext(callMethod)),
    ).rejects.toThrow('CRM_DYNAMIC_1050_DETAIL_TAB')
    expect(syncRobotConnectorsMock).not.toHaveBeenCalled()
  })
})
