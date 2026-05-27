import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'

export type UpdateInstanceSettingsInput = {
  connectorId: string
  name?: string
  settings?: Partial<ConnectorSettings>
}

export type UpdateInstanceSettingsResult = {
  id: string
  name?: string
  settings?: ConnectorSettings
}

export class UpdateInstanceSettingsUseCase {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly getDomainRepository: GetDomainRepository,
    private readonly updateInstanceGateway: UpdateInstanceGateway,
    private readonly updateInstanceRepository: UpdateInstanceRepository,
  ) {}

  async execute(
    input: UpdateInstanceSettingsInput,
  ): Promise<UpdateInstanceSettingsResult> {
    const connector = await this.getConnectorRepository.get(input.connectorId)
    if (!connector) {
      throw new Error('Connector not found')
    }

    const instance = await this.getInstanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      throw new Error('Instance not found')
    }

    const result: UpdateInstanceSettingsResult = {
      id: input.connectorId,
    }

    if (input.name !== undefined) {
      const domain = await this.getDomainRepository.getDomainById(
        instance.domainId,
      )
      if (!domain) {
        throw new Error('Domain not found')
      }

      await this.updateInstanceGateway.update(
        instance.instanceId,
        `${domain.name} | ${input.name}`,
        instance.zApiToken as string,
      )
      result.name = input.name
    }

    if (input.settings !== undefined) {
      const mergedSettings = mergeConnectorSettings(
        instance.settings,
        input.settings,
      )
      const updatedInstance =
        await this.updateInstanceRepository.updateSettings(
          instance.id,
          mergedSettings,
        )
      result.settings = updatedInstance.settings
    }

    return result
  }
}
