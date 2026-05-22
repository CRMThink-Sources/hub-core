import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiGroupListItem } from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type ListGroupsInput = {
  connectorId: string
  page?: number
  pageSize?: number
}

export class ListGroupsService {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: ListGroupsInput): Promise<ZApiGroupListItem[]> {
    const resolved = await resolveZApiInstance(
      input.connectorId,
      this.getConnectorRepository,
      this.getInstanceRepository,
      this.zApiClient,
    )

    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 20

    const groups = await this.zApiClient.listGroups(
      resolved.instanceId,
      resolved.zApiToken,
      page,
      pageSize,
    )

    return groups.filter(g => g.isGroup)
  }
}
