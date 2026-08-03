import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiGroupListItem } from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { resolveZApiInstance } from './helpers/resolve-z-api-instance'

export type ListGroupsInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
  page?: number
  pageSize?: number
}

export type ListGroupsResult = {
  items: ZApiGroupListItem[]
  /**
   * Há página seguinte.
   *
   * Medido **antes** do filtro: a Z-API pagina conversas, não grupos, então uma
   * página cheia de 20 conversas pode virar 3 grupos. Deduzir "acabou" de
   * `items.length < pageSize` travava a paginação na primeira página — o botão
   * ficava clicável e não fazia request nenhuma.
   */
  hasNextPage: boolean
}

export class ListGroupsService {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: ListGroupsInput): Promise<ListGroupsResult> {
    const resolved = await resolveZApiInstance(
      input,
      this.getAplicationContext,
      this.zApiClient,
    )

    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 20

    const conversations = await this.zApiClient.listGroups(
      resolved.instanceId,
      resolved.zApiToken,
      page,
      pageSize,
    )

    return {
      items: conversations.filter(g => g.isGroup),
      hasNextPage: conversations.length >= pageSize,
    }
  }
}
