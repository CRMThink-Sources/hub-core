import axios, { AxiosError } from 'axios'
import { BitrixClient } from './bitrix.client'
import { Credential } from '@/shared/domain/entities/credential'
import { BitrixError } from './errors/bitrix-client.error'

export class BitrixDiskClient extends BitrixClient {
  constructor(bitrixCredential: Credential, domain: string) {
    super(bitrixCredential, domain)
  }

  async getFolderId({
    chatId,
    dialogId,
  }: {
    chatId?: string
    dialogId?: string
  }) {
    if (!chatId && !dialogId) {
      throw new Error('chatId or dialogId is required')
    }
    const client = this.getClient()
    const id = chatId || dialogId
    console.log('id', id)
    try {
      const response = await client.post<{ result: { ID: string } }>(
        `im.disk.folder.get`,
        {
          DIALOG_ID: id,
        },
      )

      return response.data.result.ID
    } catch (error) {
      console.log((error as AxiosError).response?.data)
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to get folder id'
      throw new BitrixError(message)
    }
  }

  async uploadFile(file: string, folderId: string, name: string) {
    const client = this.getClient()
    try {
      const response = await client.post<{
        result: { ID: number; FILE_ID: number }
      }>(`disk.folder.uploadfile`, {
        id: folderId,
        data: {
          NAME: name,
        },
        fileContent: [name, file],
      })
      return response.data.result
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to upload file'
      throw new BitrixError(message)
    }
  }

  async commitFile(fileId: number, CHAT_ID: string) {
    const client = this.getClient()
    const chatId = CHAT_ID.includes('chat')
      ? CHAT_ID.replace('chat', '')
      : CHAT_ID
    try {
      const response = await client.post<{ result: { ID: number } }>(
        `im.disk.file.commit`,
        {
          FILE_ID: fileId,
          CHAT_ID: chatId,
        },
      )
      return response.data.result
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data.error_description)}`
          : 'Failed to commit file'
      throw new BitrixError(message)
    }
  }
}
