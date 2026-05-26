import axios from 'axios'
import { BitrixClient } from './bitrix.client'
import { Credential } from '@/shared/domain/entities/credential'
import { BitrixError } from './errors/bitrix-client.error'
import { apiLogger } from '@/shared/infra/logger'

function getBitrixErrorDetails(error: unknown) {
  if (!axios.isAxiosError(error) || !error.response) {
    return { bitrixStatus: undefined, bitrixData: undefined }
  }

  return {
    bitrixStatus: error.response.status,
    bitrixData: error.response.data,
  }
}

export class BitrixDiskClient extends BitrixClient {
  constructor(bitrixCredential: Credential, domain: string) {
    super({
      bitrixCredential,
      domain,
    })
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
    try {
      const response = await client.post<{ result: { ID: string } }>(
        `im.disk.folder.get`,
        {
          DIALOG_ID: id,
        },
      )

      return response.data.result.ID
    } catch (error) {
      const { bitrixStatus, bitrixData } = getBitrixErrorDetails(error)
      apiLogger.error(
        {
          app: 'thinkzap',
          phase: 'getFolderId',
          dialogId: id,
          bitrixStatus,
          bitrixData,
          err: error,
        },
        'bitrix-disk: getFolderId failed',
      )
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
      const { bitrixStatus, bitrixData } = getBitrixErrorDetails(error)
      apiLogger.error(
        {
          app: 'thinkzap',
          phase: 'uploadFile',
          folderId,
          fileName: name,
          bitrixStatus,
          bitrixData,
          err: error,
        },
        'bitrix-disk: uploadFile failed',
      )
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to upload file'
      throw new BitrixError(message)
    }
  }

  async commitFile(fileId: number, dialogId: string) {
    const client = this.getClient()
    try {
      const response = await client.post<{ result: { ID: number } }>(
        `im.disk.file.commit`,
        {
          FILE_ID: fileId,
          DIALOG_ID: dialogId,
        },
      )
      return response.data.result
    } catch (error) {
      const { bitrixStatus, bitrixData } = getBitrixErrorDetails(error)
      apiLogger.error(
        {
          app: 'thinkzap',
          phase: 'commitFile',
          fileId,
          dialogId,
          bitrixStatus,
          bitrixData,
          err: error,
        },
        'bitrix-disk: commitFile failed',
      )
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to commit file'
      throw new BitrixError(message)
    }
  }
}
