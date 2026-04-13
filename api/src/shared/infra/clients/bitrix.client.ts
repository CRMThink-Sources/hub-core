/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Credential } from '@/shared/domain/entities/credential'
import axios from 'axios'
import { BitrixError } from './errors/bitrix-client.error'

export class BitrixClient {
  private readonly bitrixCredential: Credential
  private readonly domain: string

  constructor(bitrixCredential: Credential, domain: string) {
    this.bitrixCredential = bitrixCredential
    this.domain = domain
  }

  getClient() {
    return axios.create({
      baseURL: `https://${this.domain}/rest/`,
      params: {
        auth: this.bitrixCredential.accessToken,
      },
    })
  }

  async activateConnector(line: number) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.activate', {
        LINE: line,
        CONNECTOR: 'hubthink_thinkzap',
        ACTIVE: 1,
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

  async sendMessage(data: ISendMessageData) {
    const client = this.getClient()
    try {
      const response = await client.post('/imconnector.send.messages', data)
      return response.data
    } catch (error) {
      console.log('error', error)
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to create conversation'
      throw new BitrixError(message)
    }
  }

  async getChat(chatId: string) {
    const client = this.getClient()
    try {
      const response = await client.get(`/im.dialog.get?DIALOG_ID=${chatId}`)
      return response.data.result
    } catch (error) {
      console.log('error', error)
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
      console.log('error', error)
    }
  }

  async getOpenChannel(id: string): Promise<IGetOpenChannelResponse> {
    const client = this.getClient()
    try {
      const response = await client.get(
        `/imopenlines.config.get?CONFIG_ID=${id}`,
      )
      return response.data.result
    } catch (error) {
      throw new BitrixError('Failed to get open channel')
    }
  }

  async getOpenChannels(): Promise<IGetOpenChannelsResponse> {
    const client = this.getClient()
    try {
      const response = await client.get('/imopenlines.config.list.get')
      return response.data
    } catch (error) {
      throw new BitrixError('Failed to get open channels')
    }
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
