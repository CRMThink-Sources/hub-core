import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiGroupMetadata } from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { enrichGroupMetadata } from './helpers/enrich-group-metadata'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type GetGroupMetadataInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
  groupId: string
}

export class GetGroupMetadataService {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: GetGroupMetadataInput): Promise<ZApiGroupMetadata> {
    const resolved = await resolveZApiInstance(
      input,
      this.getAplicationContext,
      this.zApiClient,
    )

    const metadata = await this.zApiClient.getGroupMetadata(
      resolved.instanceId,
      resolved.zApiToken,
      input.groupId,
    )

    return enrichGroupMetadata(
      metadata,
      this.zApiClient,
      resolved.instanceId,
      resolved.zApiToken,
      input.groupId,
    )
  }
}
