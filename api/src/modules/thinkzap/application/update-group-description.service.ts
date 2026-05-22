import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type UpdateGroupDescriptionInput = {
  connectorId: string
  groupId: string
  groupDescription: string
}

export class UpdateGroupDescriptionService {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(
    input: UpdateGroupDescriptionInput,
  ): Promise<{ value: boolean }> {
    const resolved = await resolveZApiInstance(
      input.connectorId,
      this.getConnectorRepository,
      this.getInstanceRepository,
      this.zApiClient,
    )

    return this.zApiClient.updateGroupDescription(
      resolved.instanceId,
      resolved.zApiToken,
      {
        groupId: input.groupId,
        groupDescription: input.groupDescription,
      },
    )
  }
}
