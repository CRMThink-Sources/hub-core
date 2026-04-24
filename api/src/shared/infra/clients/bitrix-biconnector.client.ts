import { Credential } from '@/shared/domain/entities/credential'
import { BitrixClient } from './bitrix.client'
import { BitrixResponse } from './types/bitrix'
import {
  BiconnectorResult,
  CreateBiConnectorParams,
  CreateSourceParams,
  SourceResult,
  CreateDatasetParams,
  DatasetFieldInput,
  DatasetResult,
} from './types/biconnector'

type BitrixErrorResponse = {
  error: string
  error_description?: string
}

export class BitrixBiConnectorClient extends BitrixClient {
  constructor(bitrixCredential: Credential, domain: string) {
    super({
      bitrixCredential,
      domain,
    })
  }

  private checkError<T>(
    data: BitrixResponse<T> | BitrixErrorResponse,
  ): asserts data is BitrixResponse<T> {
    if ('error' in data && data.error) {
      throw new Error(data.error_description ?? data.error)
    }
  }

  async biconnectorAdd(
    fields: CreateBiConnectorParams,
  ): Promise<BiconnectorResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<BiconnectorResult>>(
      '/biconnector.connector.add',
      { fields },
    )
    this.checkError(response.data)
    return response.data.result
  }

  async biconnectorList(): Promise<BiconnectorResult[]> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<BiconnectorResult[]>>(
      '/biconnector.connector.list',
    )
    this.checkError(response.data)
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
    this.checkError(response.data)
    return response.data.result
  }

  async biconnectorDelete(id: number): Promise<boolean> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<boolean>>(
      '/biconnector.connector.delete',
      { id },
    )
    this.checkError(response.data)
    return response.data.result
  }

  async sourceAdd(fields: CreateSourceParams): Promise<SourceResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<SourceResult>>(
      '/biconnector.source.add',
      { fields },
    )
    this.checkError(response.data)
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
    this.checkError(response.data)
    return response.data.result
  }

  async sourceList(connectorId?: number): Promise<SourceResult[]> {
    const client = this.getClient()
    const body = connectorId ? { filter: { connectorId } } : {}
    const response = await client.post<BitrixResponse<SourceResult[]>>(
      '/biconnector.source.list',
      body,
    )
    this.checkError(response.data)
    return response.data.result
  }

  async sourceDelete(id: number): Promise<boolean> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<boolean>>(
      '/biconnector.source.delete',
      { id },
    )
    this.checkError(response.data)
    return response.data.result
  }

  async datasetAdd(fields: CreateDatasetParams): Promise<DatasetResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<DatasetResult>>(
      '/biconnector.dataset.add',

      { fields },
    )
    this.checkError(response.data)
    return response.data.result
  }

  async datasetUpdate(
    id: number,
    fields: Partial<Omit<CreateDatasetParams, 'sourceId'>>,
  ): Promise<DatasetResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<DatasetResult>>(
      '/biconnector.dataset.update',
      { id, fields },
    )
    this.checkError(response.data)
    return response.data.result
  }

  async datasetFieldsUpdate(
    id: number,
    fields: DatasetFieldInput[],
  ): Promise<DatasetResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<DatasetResult>>(
      '/biconnector.dataset.fields.update',
      { id, fields },
    )
    this.checkError(response.data)
    return response.data.result
  }

  async datasetGet(id: number): Promise<DatasetResult> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<{ item: DatasetResult }>>(
      '/biconnector.dataset.get',
      { id },
    )
    this.checkError(response.data)
    return response.data.result.item
  }

  async datasetList(sourceId?: number): Promise<DatasetResult[]> {
    const client = this.getClient()
    const body = sourceId ? { filter: { sourceId } } : {}
    const response = await client.post<BitrixResponse<DatasetResult[]>>(
      '/biconnector.dataset.list',
      body,
    )
    this.checkError(response.data)
    return response.data.result
  }

  async datasetDelete(id: number): Promise<boolean> {
    const client = this.getClient()
    const response = await client.post<BitrixResponse<boolean>>(
      '/biconnector.dataset.delete',
      { id },
    )
    this.checkError(response.data)
    return response.data.result
  }
}
