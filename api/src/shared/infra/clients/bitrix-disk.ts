import axios, { type AxiosInstance } from 'axios'
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
    bitrixData: error.response.data as Record<string, unknown>,
  }
}

type BitrixDiskClientDeps = {
  post?: AxiosInstance['post']
}

type BitrixDiskClientUserTokenParams = {
  domain: string
  accessToken: string
  post?: AxiosInstance['post']
}

export type ImV2FileUploadResult = {
  dialogId: string
  chatId?: number
  messageId: number
  file: {
    id: number
    name: string
    extension?: string
    size?: number
  }
}

export class BitrixDiskClient extends BitrixClient {
  private readonly httpPost?: AxiosInstance['post']

  constructor(bitrixCredential: Credential, domain: string)
  constructor(params: BitrixDiskClientUserTokenParams)
  constructor(
    credentialOrParams: Credential | BitrixDiskClientUserTokenParams,
    domain?: string,
  ) {
    if ('appId' in credentialOrParams) {
      super({
        bitrixCredential: credentialOrParams,
        domain: domain!,
      })
      return
    }

    super({
      domain: credentialOrParams.domain,
      accessToken: credentialOrParams.accessToken,
    })
    this.httpPost = credentialOrParams.post
  }

  static withUserToken(
    domain: string,
    accessToken: string,
    deps?: BitrixDiskClientDeps,
  ): BitrixDiskClient {
    return new BitrixDiskClient({ domain, accessToken, post: deps?.post })
  }

  async uploadFileToChat({
    dialogId,
    fileName,
    base64,
    message,
  }: {
    dialogId: string
    fileName: string
    base64: string
    message?: string
  }): Promise<ImV2FileUploadResult> {
    const post = this.httpPost ?? this.getClient().post.bind(this.getClient())

    try {
      const response = await post<{ result: ImV2FileUploadResult }>(
        'im.v2.File.upload',
        {
          dialogId,
          fields: {
            name: fileName,
            content: base64,
            message: message ?? '',
          },
        },
      )
      return response.data.result
    } catch (error) {
      const { bitrixStatus, bitrixData } = getBitrixErrorDetails(error)
      apiLogger.error(
        {
          app: 'thinkzap',
          phase: 'im.v2.File.upload',
          dialogId,
          fileName,
          bitrixStatus,
          bitrixData,
          err: error,
        },
        'bitrix-disk: uploadFileToChat failed',
      )
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : 'Failed to upload file to chat'
      throw new BitrixError(message)
    }
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
    const client = super.getClient()
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
    const client = super.getClient()
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
    const client = super.getClient()
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
