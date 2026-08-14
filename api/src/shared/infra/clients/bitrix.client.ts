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
      if (error instanceof Error) {
        console.log(error)
      }
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

  async deleteMessage(data: ISendMessageData) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.delete.messages', data)
      return response.data
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to delete message'
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

  async getLastMessageId(chatId: string): Promise<string | null> {
    const client = this.getClient()
    try {
      const response = await client.get<{ result?: IDialogGetResult }>(
        '/im.dialog.get',
        { params: { DIALOG_ID: `chat${chatId}` } },
      )
      const lastMessageId = response.data?.result?.last_message_id
      return lastMessageId != null ? String(lastMessageId) : null
    } catch (error) {
      const wrapped = wrapBitrixRequestError('im.dialog.get', error)
      console.error('[BitrixClient] getLastMessageId error:', wrapped.message)
      return null
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
      const response = await client.get<ICrmItemResponse>(`/crm.item.get`, {
        params: { entityTypeId, id },
      })
      return response.data
    } catch (error) {
      throw new BitrixError('Failed to get CRM item')
    }
  }

  /**
   * Descreve os campos de uma SPA. Serve para verificar que um campo custom
   * existe **antes** de escrever nele: `crm.item.update` ignora campo desconhecido
   * sem devolver erro, então gravar num campo inexistente é perda silenciosa.
   */
  async getCrmItemFields(
    entityTypeId: number,
  ): Promise<ICrmItemFieldsResponse> {
    const client = this.getClient()
    try {
      const response = await client.get<ICrmItemFieldsResponse>(
        `/crm.item.fields`,
        { params: { entityTypeId } },
      )
      return response.data
    } catch (error) {
      console.error('[BitrixClient] getCrmItemFields error:', error)
      throw new BitrixError('Failed to describe CRM item fields')
    }
  }

  async listCrmItems(
    entityTypeId: number,
    filter: Record<string, unknown>,
    options?: { select?: string[]; start?: number },
  ): Promise<ICrmItemListResponse> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.item.list`, {
        entityTypeId,
        filter,
        ...(options?.select ? { select: options.select } : {}),
        // `start` só vai quando pedido: o Bitrix trata ausência como primeira página, e
        // mandar `0` explicitamente não muda nada — mas mandar `undefined` sim.
        ...(options?.start !== undefined ? { start: options.start } : {}),
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

  async getDealContactIds(dealId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.deal.contact.items.get`, {
        id: dealId,
      })
      const result = (response.data as { result?: unknown })?.result
      if (!Array.isArray(result)) return []
      return (result as { CONTACT_ID: number | string }[]).map(item =>
        String(item.CONTACT_ID),
      )
    } catch (error) {
      console.error('[BitrixClient] getDealContactIds error:', error)
      throw new BitrixError('Failed to get deal contact ids')
    }
  }

  async getCompanyContactIds(companyId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const response = await client.post(`/crm.company.contact.list`, {
        filter: { COMPANY_ID: companyId },
        select: ['CONTACT_ID'],
      })
      const result = (response.data as { result?: unknown })?.result
      if (!Array.isArray(result)) return []
      return (result as { CONTACT_ID: number | string }[]).map(item =>
        String(item.CONTACT_ID),
      )
    } catch (error) {
      console.error('[BitrixClient] getCompanyContactIds error:', error)
      throw new BitrixError('Failed to get company contact ids')
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

  async sendToOpenChannel(
    lineId: string,
    connectorCode: string,
    phone: string,
    message: string,
  ): Promise<{ chatId: string | null; bitrixMessageId: string | null }> {
    const messageId = `widget_${Date.now()}_${phone}`
    console.log(phone)
    const params: ISendMessageData = {
      CONNECTOR: connectorCode,
      LINE: Number(lineId),
      MESSAGES: [
        {
          chat: { id: phone, name: phone },
          user: { id: phone, name: phone, last_name: '', phone: phone },
          message: {
            id: messageId,
            date: new Date().toISOString(),
            text: '[Mensagem enviada a partir do CRM]\n' + message,
          },
        },
      ],
    }
    const client = this.getClient()
    try {
      const response = await client.post<{
        result?: {
          DATA?: {
            RESULT?: Array<{
              session?: { CHAT_ID?: string | number }
              message?: { id?: string | number }
            }>
          }
        }
      }>('/imconnector.send.messages', params)
      const result = response.data?.result?.DATA?.RESULT?.[0]
      const rawChatId = result?.session?.CHAT_ID
      const rawMsgId = result?.message?.id
      const chatId = rawChatId != null ? String(rawChatId) : null
      const bitrixMessageId = rawMsgId != null ? String(rawMsgId) : null
      return { chatId, bitrixMessageId }
    } catch (error) {
      const msg =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to create open channel conversation'
      throw new BitrixError(msg)
    }
  }
}

export interface ICrmItemResponse {
  result: {
    item: Record<string, unknown>
  }
}

export interface ICrmItemFieldsResponse {
  result: {
    fields: Record<string, { type?: string; isReadOnly?: boolean }>
  }
}

export interface ICrmItemListResponse {
  result: {
    items: {
      id: string
    }[]
  }
  /**
   * O `start` da página seguinte. **Ausente na última página** — é assim que o Bitrix
   * sinaliza o fim, e é por isso que quem pagina para no `undefined` em vez de comparar
   * com `total`.
   *
   * A maioria das leituras daqui ignora este campo de propósito: elas filtram por pai ou
   * por id e caberiam sempre na primeira página. Quem varre a SPA inteira — backfill —
   * precisa dele, e sem ele cobriria só os 50 primeiros itens em silêncio.
   */
  next?: number
  total?: number
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

export interface IDialogGetResult {
  last_message_id?: number
  entity_type?: string
  entity_id?: string
}

export interface IGetOpenChannelsResponse {
  result: {
    LINE_NAME: string
    ACTIVE: string
    ID: string
  }[]
}
