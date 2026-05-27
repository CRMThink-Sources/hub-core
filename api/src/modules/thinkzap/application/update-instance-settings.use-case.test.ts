import { describe, expect, it, vi } from 'vitest'
import { UpdateInstanceSettingsUseCase } from './update-instance-settings.use-case'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

describe('UpdateInstanceSettingsUseCase', () => {
  const connector = {
    id: 'connector-1',
    instanceId: 'instance-db-1',
    appId: 'app-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const instance = {
    id: 'instance-db-1',
    domainId: 'domain-1',
    instanceId: 'z-api-1',
    vinculatedChannel: '10',
    zApiToken: 'token',
    settings: DEFAULT_CONNECTOR_SETTINGS,
    phoneNumber: null,
    status: 'CONNECTED' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('updates only name when settings are not provided', async () => {
    const updateInstanceGateway = {
      update: vi.fn().mockResolvedValue(undefined),
    }

    const useCase = new UpdateInstanceSettingsUseCase(
      {
        get: vi.fn().mockResolvedValue(connector),
      } as never,
      {
        getInstance: vi.fn().mockResolvedValue(instance),
      } as never,
      {
        getDomainById: vi
          .fn()
          .mockResolvedValue({ id: 'domain-1', name: 'acme' }),
      } as never,
      updateInstanceGateway as never,
      {
        updateSettings: vi.fn(),
      } as never,
    )

    const result = await useCase.execute({
      connectorId: 'connector-1',
      name: 'Canal principal',
    })

    expect(result).toEqual({
      id: 'connector-1',
      name: 'Canal principal',
    })
    expect(updateInstanceGateway.update).toHaveBeenCalledWith(
      'z-api-1',
      'acme | Canal principal',
      'token',
    )
  })

  it('updates only settings when name is not provided', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...instance,
      settings: { prefixOperatorNameEnabled: true },
    })

    const useCase = new UpdateInstanceSettingsUseCase(
      {
        get: vi.fn().mockResolvedValue(connector),
      } as never,
      {
        getInstance: vi.fn().mockResolvedValue(instance),
      } as never,
      {
        getDomainById: vi.fn(),
      } as never,
      {
        update: vi.fn(),
      } as never,
      {
        updateSettings,
      } as never,
    )

    const result = await useCase.execute({
      connectorId: 'connector-1',
      settings: { prefixOperatorNameEnabled: true },
    })

    expect(result).toEqual({
      id: 'connector-1',
      settings: { prefixOperatorNameEnabled: true },
    })
    expect(updateSettings).toHaveBeenCalledWith('instance-db-1', {
      prefixOperatorNameEnabled: true,
    })
  })

  it('throws when connector is not found', async () => {
    const useCase = new UpdateInstanceSettingsUseCase(
      {
        get: vi.fn().mockResolvedValue(null),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    await expect(
      useCase.execute({ connectorId: 'missing', name: 'Canal' }),
    ).rejects.toThrow('Connector not found')
  })
})
