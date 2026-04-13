import { Credential } from '@/shared/domain/entities/credential'
import { BitrixClient } from './bitrix.client'
import { BitrixResponse } from './types/bitrix'
import {
  BiconnectorAddResult,
  BiconnectorItem,
  CreateBiConnectorParams,
} from './types/biconnector'

export class BitrixBiConnectorClient extends BitrixClient {
  constructor(bitrixCredential: Credential, domain: string) {
    super(bitrixCredential, domain)
  }

  async biconnectorAdd(
    fields: CreateBiConnectorParams,
  ): Promise<BiconnectorAddResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<BiconnectorAddResult>>(
      '/biconnector.connector.add',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      { fields },
    )
    return response.data.result
  }

  async biconnectorList(): Promise<BiconnectorItem[]> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<BiconnectorItem[]>>(
      '/biconnector.connector.list',
    )
    return response.data.result
  }

  async biconnectorDelete(id: number): Promise<boolean> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<boolean>>(
      '/biconnector.connector.delete',
      { id },
    )
    return response.data.result
  }
}
