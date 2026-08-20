import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type UpdateGroupNameInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
  groupId: string
  groupName: string
}

export class UpdateGroupNameService {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: UpdateGroupNameInput): Promise<{ value: boolean }> {
    const resolved = await resolveZApiInstance(
      input,
      this.getAplicationContext,
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
