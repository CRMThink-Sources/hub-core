import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { normalizeGroupPhones } from './helpers/normalize-group-phones'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type AddGroupParticipantsInput = {
  connectorId: string
  groupId: string
  autoInvite: boolean
  phones: string[]
}

export class AddGroupParticipantsService {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: AddGroupParticipantsInput): Promise<{ value: boolean }> {
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

    return this.zApiClient.addGroupParticipants(
      resolved.instanceId,
      resolved.zApiToken,
      {
        autoInvite: input.autoInvite,
        groupId: input.groupId,
        phones: normalizedPhones,
      },
    )
  }
}
