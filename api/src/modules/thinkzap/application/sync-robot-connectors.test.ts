import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { buildThinkzapRobotUpdateParams } from './build-thinkzap-robot-add-params'
import { syncThinkzapRobotConnectorOptions } from './sync-robot-connectors'

const listConnectors = vi.fn()
const getInstance = vi.fn()

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-connector.repository',
  () => ({
    PrismaConnectorRepository: class {
      listConnectors = listConnectors
    },
  }),
)

vi.mock('../infra/clients/z-api.client', () => ({
  ZApiClient: class {
    getInstance = getInstance
  },
}))

vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByAppId: vi.fn(),
}))

describe('syncThinkzapRobotConnectorOptions', () => {
  const callMethod = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(makeBitrixClientByAppId).mockResolvedValue({
      callMethod,
    } as never)
    listConnectors.mockResolvedValue([
      {
        id: 'connector-1',
        instanceId: 'instance-1',
        instance: { instanceId: 'z-instance-1', zApiToken: 'token' },
      },
    ])
    getInstance.mockResolvedValue({ name: 'ThinkZap | Comercial' })
  })

  it('updates the robot with connector options and no document-type filter', async () => {
    await syncThinkzapRobotConnectorOptions('app-1')

    const expected = buildThinkzapRobotUpdateParams()
    expected.FIELDS.PROPERTIES.connector.Options = {
      'connector-1': 'Comercial',
    }

    expect(callMethod).toHaveBeenCalledWith('bizproc.robot.update', expected)

    const params = callMethod.mock.calls[0]?.[1] as
      | { FIELDS: Record<string, unknown> }
      | undefined
    expect(params?.FIELDS).not.toHaveProperty('FILTER')
  })

  it('falls back to the phone number when z-api returns no instance name', async () => {
    listConnectors.mockResolvedValue([
      {
        id: 'connector-1',
        instanceId: 'instance-1',
        instance: {
          instanceId: 'z-instance-1',
          zApiToken: 'token',
          phoneNumber: '5511999999999',
        },
      },
    ])
    getInstance.mockResolvedValue({ connected: false })

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(optionsFromLastCall()).toEqual({
      'connector-1': '5511999999999',
    })
  })

  it('falls back to the instance id when z-api fails and there is no phone number', async () => {
    listConnectors.mockResolvedValue([
      {
        id: 'connector-1',
        instanceId: 'instance-1',
        instance: {
          instanceId: 'z-instance-1',
          zApiToken: null,
          phoneNumber: null,
        },
      },
    ])
    getInstance.mockRejectedValue(new Error('Failed to get instance data'))

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(callMethod).toHaveBeenCalledTimes(1)
    expect(optionsFromLastCall()).toEqual({
      'connector-1': 'z-instance-1',
    })
  })

  it('keeps syncing the remaining connectors when one instance fails', async () => {
    listConnectors.mockResolvedValue([
      {
        id: 'connector-broken',
        instanceId: 'instance-1',
        instance: {
          instanceId: 'z-instance-1',
          zApiToken: 'token',
          phoneNumber: null,
        },
      },
      {
        id: 'connector-ok',
        instanceId: 'instance-2',
        instance: {
          instanceId: 'z-instance-2',
          zApiToken: 'token',
          phoneNumber: null,
        },
      },
    ])
    getInstance
      .mockRejectedValueOnce(new Error('Failed to get instance data'))
      .mockResolvedValueOnce({ name: 'ThinkZap | Suporte' })

    await syncThinkzapRobotConnectorOptions('app-1')

    expect(optionsFromLastCall()).toEqual({
      'connector-broken': 'z-instance-1',
      'connector-ok': 'Suporte',
    })
  })

  function optionsFromLastCall(): Record<string, string> | undefined {
    const params = callMethod.mock.calls.at(-1)?.[1] as
      | {
          FIELDS: {
            PROPERTIES: { connector: { Options: Record<string, string> } }
          }
        }
      | undefined

    return params?.FIELDS.PROPERTIES.connector.Options
  }
})
