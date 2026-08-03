import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { normalizeGroupPhones } from './helpers/normalize-group-phones'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type CreateGroupInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
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
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: CreateGroupInput): Promise<CreateGroupOutput> {
    const resolved = await resolveZApiInstance(
      input,
      this.getAplicationContext,
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
