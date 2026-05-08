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
import axios from 'axios'

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

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        const isRateLimit = // axios usado diretamente, BitrixClient depende do axios internamente
          axios.isAxiosError(error) &&
          error.response?.status === 503 &&
          (error.response.data as { error?: string })?.error ===
            'QUERY_LIMIT_EXCEEDED'

        if (isRateLimit && attempt < maxRetries) {
          console.warn(
            `[BiConnector] limite de sessao atingido, tentativa ${attempt + 1}/${maxRetries}. Aguardando ${1000 * Math.pow(2, attempt)}ms`,
          )
          await new Promise(resolve =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt)),
          )
          continue
        }
        throw error
      }
    }
    throw new Error(`[BiConnector] withRetry encerrado sem retorno`)
  }

  async biconnectorAdd(
    fields: CreateBiConnectorParams,
  ): Promise<BiconnectorResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<BiconnectorResult>>(
        '/biconnector.connector.add',
        { fields },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async biconnectorList(): Promise<BiconnectorResult[]> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<BiconnectorResult[]>>(
        '/biconnector.connector.list',
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async biconnectorUpdate(
    id: number,
    fields: Partial<CreateBiConnectorParams>,
  ): Promise<BiconnectorResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<BiconnectorResult>>(
        '/biconnector.connector.update',
        { id, fields },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async biconnectorDelete(id: number): Promise<boolean> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<boolean>>(
        '/biconnector.connector.delete',
        { id },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async sourceAdd(fields: CreateSourceParams): Promise<SourceResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<SourceResult>>(
        '/biconnector.source.add',
        { fields },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async sourceUpdate(
    id: number,
    fields: Partial<Omit<CreateSourceParams, 'connectorId'>>,
  ): Promise<SourceResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<SourceResult>>(
        '/biconnector.source.update',
        { id, fields },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async sourceList(connectorId?: number): Promise<SourceResult[]> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const body = connectorId ? { filter: { connectorId } } : {}
      const response = await client.post<BitrixResponse<SourceResult[]>>(
        '/biconnector.source.list',
        body,
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async sourceDelete(id: number): Promise<boolean> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<boolean>>(
        '/biconnector.source.delete',
        { id },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async datasetAdd(fields: CreateDatasetParams): Promise<DatasetResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<DatasetResult>>(
        '/biconnector.dataset.add',

        { fields },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async datasetUpdate(
    id: number,
    fields: Partial<Omit<CreateDatasetParams, 'sourceId'>>,
  ): Promise<DatasetResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<DatasetResult>>(
        '/biconnector.dataset.update',
        { id, fields },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async datasetFieldsUpdate(
    id: number,
    fields: DatasetFieldInput[],
  ): Promise<DatasetResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<DatasetResult>>(
        '/biconnector.dataset.fields.update',
        { id, fields },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async datasetGet(id: number): Promise<DatasetResult> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<
        BitrixResponse<{ item: DatasetResult }>
      >('/biconnector.dataset.get', { id })
      this.checkError(response.data)
      return response.data.result.item
    })
  }

  async datasetList(sourceId?: number): Promise<DatasetResult[]> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const body = sourceId ? { filter: { sourceId } } : {}
      const response = await client.post<BitrixResponse<DatasetResult[]>>(
        '/biconnector.dataset.list',
        body,
      )
      this.checkError(response.data)
      return response.data.result
    })
  }

  async datasetDelete(id: number): Promise<boolean> {
    return this.withRetry(async () => {
      const client = this.getClient()
      const response = await client.post<BitrixResponse<boolean>>(
        '/biconnector.dataset.delete',
        { id },
      )
      this.checkError(response.data)
      return response.data.result
    })
  }
}
