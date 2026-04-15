import { Credential } from '@/shared/domain/entities/credential'
import { BitrixClient } from './bitrix.client'
import { BitrixResponse } from './types/bitrix'
import {
  BiconnectorResult,
  CreateBiConnectorParams,
  CreateSourceParams,
  SourceResult,
} from './types/biconnector'

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

  async biconnectorUpdate(
    id: number,
    fields: Partial<CreateBiConnectorParams>,
  ): Promise<BiconnectorResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<BiconnectorResult>>(
      '/biconnector.connector.update',
      { id, fields },
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

  async sourceAdd(fields: CreateSourceParams): Promise<SourceResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<SourceResult>>(
      '/biconnector.source.add',
      { fields },
    )
    return response.data.result
  }

  async sourceUpdate(
    id: number,
    fields: Partial<Omit<CreateSourceParams, 'connectorId'>>,
  ): Promise<SourceResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<SourceResult>>(
      '/biconnector.source.update',
      { id, fields },
    )
    return response.data.result
  }

  async sourceList(connectorId?: number): Promise<SourceResult[]> {
    const client = this.getClient()
    const body = connectorId ? { filter: { connectorId } } : {}
    const response = await client.post<BitrixResponse<SourceResult[]>>(
      '/biconnector.source.list',
      body,
    )
    return response.data.result
  }

  async sourceDelete(id: number): Promise<boolean> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<boolean>>(
      '/biconnector.source.delete',
      { id },
    )
    return response.data.result
  }
}
