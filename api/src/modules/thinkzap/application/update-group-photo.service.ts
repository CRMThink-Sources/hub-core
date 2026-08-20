import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type UpdateGroupPhotoInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
  groupId: string
  groupPhoto: string
}

export class UpdateGroupPhotoService {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: UpdateGroupPhotoInput): Promise<{ value: boolean }> {
    const resolved = await resolveZApiInstance(
      input,
      this.getAplicationContext,
      this.zApiClient,
    )

    return this.zApiClient.updateGroupPhoto(
      resolved.instanceId,
      resolved.zApiToken,
      {
        groupId: input.groupId,
        groupPhoto: input.groupPhoto,
      },
    )
  }
}
