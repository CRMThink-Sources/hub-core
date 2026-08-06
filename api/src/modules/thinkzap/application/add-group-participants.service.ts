import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { normalizeGroupPhones } from './helpers/normalize-group-phones'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type AddGroupParticipantsInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
  groupId: string
  autoInvite: boolean
  phones: string[]
}

export class AddGroupParticipantsService {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: AddGroupParticipantsInput): Promise<{ value: boolean }> {
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
