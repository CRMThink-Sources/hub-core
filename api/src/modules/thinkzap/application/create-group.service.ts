import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { normalizeGroupPhones } from './helpers/normalize-group-phones'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type CreateGroupInput = {
  connectorId: string
  groupName: string
  autoInvite: boolean
  phones: string[]
}

export type CreateGroupOutput = {
  phone: string
  invitationLink: string
}

export class CreateGroupService {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: CreateGroupInput): Promise<CreateGroupOutput> {
    const resolved = await resolveZApiInstance(
      input.connectorId,
      this.getConnectorRepository,
      this.getInstanceRepository,
      this.zApiClient,
    )

    const normalizedPhones = normalizeGroupPhones(
      input.phones,
      resolved.instancePhone,
      {
        minCount: 1,
      },
    )

    const result = await this.zApiClient.createGroup(
      resolved.instanceId,
      resolved.zApiToken,
      {
        autoInvite: input.autoInvite,
        groupName: input.groupName.trim(),
        phones: normalizedPhones,
      },
    )

    return {
      phone: result.phone,
      invitationLink: result.invitationLink,
    }
  }
}
