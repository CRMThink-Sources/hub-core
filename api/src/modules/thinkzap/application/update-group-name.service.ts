import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type UpdateGroupNameInput = {
  connectorId: string
  groupId: string
  groupName: string
}

export class UpdateGroupNameService {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: UpdateGroupNameInput): Promise<{ value: boolean }> {
    const resolved = await resolveZApiInstance(
      input.connectorId,
      this.getConnectorRepository,
      this.getInstanceRepository,
      this.zApiClient,
    )

    return this.zApiClient.updateGroupName(
      resolved.instanceId,
      resolved.zApiToken,
      {
        groupId: input.groupId,
        groupName: input.groupName.trim(),
      },
    )
  }
}
