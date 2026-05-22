import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiGroupMetadata } from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { enrichGroupMetadata } from './helpers/enrich-group-metadata'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type GetGroupMetadataInput = {
  connectorId: string
  groupId: string
}

export class GetGroupMetadataService {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: GetGroupMetadataInput): Promise<ZApiGroupMetadata> {
    const resolved = await resolveZApiInstance(
      input.connectorId,
      this.getConnectorRepository,
      this.getInstanceRepository,
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
    )
  }
}
