import { Credential } from '@/shared/domain/entities/credential'
import { BitrixClient } from './bitrix.client'
import { BitrixResponse } from './types/bitrix'
import { BiconnectorResult, CreateBiConnectorParams } from './types/biconnector'

export class BitrixBiConnectorClient extends BitrixClient {
  constructor(bitrixCredential: Credential, domain: string) {
    super(bitrixCredential, domain)
  }

  async biconnectorAdd(
    fields: CreateBiConnectorParams,
  ): Promise<BiconnectorResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<BiconnectorResult>>(
      '/biconnector.connector.add',
      { fields },
    )
    return response.data.result
  }

  async biconnectorList(): Promise<BiconnectorResult[]> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<BiconnectorResult[]>>(
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
