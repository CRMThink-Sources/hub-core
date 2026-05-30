/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Credential } from '@/shared/domain/entities/credential'
import axios from 'axios'
import { getBitrixAxiosDefaults } from './bitrix-axios-config'
import { BitrixError } from './errors/bitrix-client.error'
import {
  formatBitrixApiError,
  wrapBitrixRequestError,
} from './bitrix-http-errors'
import { normalizeBitrixDomain } from './normalize-bitrix-domain'
import { PlacementHandlerEntry } from '@/modules/thinkzap/application/normalize-placement-get-response'

interface IBitrixClientParams {
  bitrixCredential?: Credential
  domain?: string
  webhook?: string
  accessToken?: string
}

export class BitrixClient {
  private readonly bitrixCredential?: Credential
  private readonly domain?: string
  private readonly webhook?: string
  private readonly accessToken?: string

  constructor(params: IBitrixClientParams) {
    this.bitrixCredential = params.bitrixCredential
    this.domain = params.domain
      ? normalizeBitrixDomain(params.domain)
      : params.domain
    this.webhook = params.webhook
    this.accessToken = params.accessToken
  }

  static withUserToken(domain: string, accessToken: string): BitrixClient {
    return new BitrixClient({ domain, accessToken })
  }

  getClient() {
    const axiosDefaults = getBitrixAxiosDefaults()

    if (this.webhook) {
      return axios.create({
        baseURL: this.webhook,
        ...axiosDefaults,
      })
    }
    if (this.accessToken && this.domain) {
      return axios.create({
        baseURL: `https://${this.domain}/rest/`,
        params: {
          auth: this.accessToken,
        },
        ...axiosDefaults,
      })
    }
    if (!this.bitrixCredential || !this.domain) {
      throw new Error('Bitrix credential and domain are required')
    }
    return axios.create({
      baseURL: `https://${this.domain}/rest/`,
      params: {
        auth: this.bitrixCredential.accessToken,
      },
      ...axiosDefaults,
    })
  }

  async activateConnector(line: number, connector: string, active: number = 1) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.activate', {
        LINE: line,
        CONNECTOR: connector,
        ACTIVE: active,
      })

      return response.data
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to activate connector'
      throw new BitrixError(message)
    }
  }

  async callMethod<T = unknown>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const client = this.getClient()
    try {
      const response = await client.post(`/${method}`, params)
      return response.data as T
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : `Failed to call Bitrix method: ${method}`
      throw new BitrixError(message)
    }
  }

  async sendMessage(data: ISendMessageData) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.send.messages', data)
      return response.data
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to create conversation'
      throw new BitrixError(message)
    }
  }

  async updateMessage(data: ISendMessageData) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.update.messages', data)
      return response.data
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to update message'
      throw new BitrixError(message)
    }
  }

  async getChat(chatId: string) {
    const client = this.getClient()
    try {
      const response = await client.get(`/im.dialog.get?DIALOG_ID=${chatId}`)
      return response.data.result
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to get chat'
      throw new BitrixError(message)
    }
  }

  async setMessageDelivered(data: ISetMessageDeliveredData) {
    const client = this.getClient()
    try {
      const response = await client.post(
        '/imconnector.send.status.delivery',
        data,
      )
      return response.data
    } catch (error) {
      console.error('[BitrixClient] setMessageDelivered error:', error)
    }
  }

  async getOpenChannel(id: string): Promise<IGetOpenChannelResponse> {
    const client = this.getClient()
    try {
      const response = await client.post('/imopenlines.config.get', {
        CONFIG_ID: id,
      })
      return response.data.result
    } catch (error) {
      const wrapped = wrapBitrixRequestError('imopenlines.config.get', error)
      throw new BitrixError(wrapped.message)
    }
  }

  async getOpenChannels(): Promise<IGetOpenChannelsResponse> {
    const client = this.getClient()
    try {
      const response = await client.post('/imopenlines.config.list.get', {})
      return response.data
    } catch (error) {
      const wrapped = wrapBitrixRequestError(
        'imopenlines.config.list.get',
        error,
      )
      throw new BitrixError(wrapped.message)
    }
  }

  async getCrmItem(
    entityTypeId: number,
    id: string,
  ): Promise<ICrmItemResponse> {
    const client = this.getClient()
    try {
      const response = await client.get(`/crm.item.get`, {
        params: { entityTypeId, id },
      })
      return response.data
    } catch (error) {
      throw new BitrixError('Failed to get CRM item')
    }
  }

  async listCrmItems(
    entityTypeId: number,
    filter: Record<string, unknown>,
    options?: { select?: string[] },
  ): Promise<ICrmItemListResponse> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.item.list`, {
        entityTypeId,
        filter,
        ...(options?.select ? { select: options.select } : {}),
      })
      return response.data
    } catch (error) {
      console.error('[BitrixClient] listCrmItems error:', error)
      throw new BitrixError('Failed to list CRM items')
    }
  }

  async createCrmItem(
    entityTypeId: number,
    fields: Record<string, unknown>,
  ): Promise<ICrmItemCreateResponse> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.item.add`, {
        entityTypeId,
        fields,
      })
      return response.data
    } catch (error) {
      console.error('[BitrixClient] createCrmItem error:', error)
      throw new BitrixError('Failed to create CRM item')
    }
  }

  async updateCrmItem(
    entityTypeId: number,
    id: string,
    fields: Record<string, unknown>,
  ): Promise<ICrmItemUpdateResponse> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.item.update`, {
        entityTypeId,
        id,
        fields,
      })
      return response.data
    } catch (error) {
      console.error('[BitrixClient] updateCrmItem error:', error)
      throw new BitrixError('Failed to update CRM item')
    }
  }

  async getPlacementHandlers(): Promise<
    PlacementHandlerEntry[] | { result?: PlacementHandlerEntry[] }
  > {
    const client = this.getClient()
    try {
      const response = await client.post('/placement.get', {})
      const data = response.data as {
        error?: string
        error_description?: string
        result?: PlacementHandlerEntry[]
      }

      if (data.error) {
        throw new BitrixError(
          formatBitrixApiError(
            'placement.get',
            data.error,
            data.error_description,
          ),
        )
      }

      return data.result ?? data
    } catch (error) {
      console.error('[BitrixClient] getPlacementHandlers error:', error)
      if (error instanceof BitrixError) {
        throw error
      }

      const wrapped = wrapBitrixRequestError('placement.get', error)
      throw new BitrixError(wrapped.message)
    }
  }
}

export interface ICrmItemResponse {
  result: {
    item: Record<string, unknown>
  }
}

export interface ICrmItemListResponse {
  result: {
    items: {
      id: string
    }[]
  }
}

export interface ICrmItemCreateResponse {
  result: {
    item: {
      id: string
    }
  }
}

export interface ICrmItemUpdateResponse {
  result: {
    id: string
  }
}
export interface IGetOpenChannelResponse {
  LINE_NAME: string
}

export interface ISendMessageData {
  CONNECTOR: string
  LINE: number
  MESSAGES: {
    user: {
      id: string
      name: string
      last_name: string
      phone: string
      picture?: {
        url: string
      }
    }
    message: {
      id: string
      date: string
      text: string
      files?: {
        url: string
        name: string
      }[]
    }
    chat: {
      id: string
      name: string
    }
  }[]
}

interface ISetMessageDeliveredData {
  CONNECTOR: string
  LINE: string
  MESSAGES: {
    im: any
    message: {
      id: string
    }
    chat: {
      id: string
    }
  }[]
}

export interface IGetOpenChannelsResponse {
  result: {
    LINE_NAME: string
    ACTIVE: string
    ID: string
  }[]
}
