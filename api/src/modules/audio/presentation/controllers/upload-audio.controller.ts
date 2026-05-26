import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { BitrixDiskClient } from '@/shared/infra/clients/bitrix-disk'
import { apiLogger } from '@/shared/infra/logger'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { Controller } from '@/shared/presentation/controller'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import type { Request, Response } from 'express'
import z from 'zod'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'

export class UploadAudioController extends Controller {
  constructor(
    private readonly getDomainRepository: GetDomainRepository,
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getInstalledAppRepository: GetInstalledAppRepository,
    private readonly credentialRepository: GetCredentialRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const params = z
      .object({
        dialogId: z.string(),
        userId: z.string().optional(),
        domain: z.string().min(1),
      })
      .safeParse(req.body)

    if (!params.success) {
      apiLogger.warn(
        { app: 'thinkzap', validationError: params.error.message },
        'audio-upload: requisicao invalida',
      )
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { dialogId, userId, domain } = params.data
    const parsedDomain = domain.split('://')[1] || ''
    const startedAt = Date.now()

    const audio = req.file
    const base64 = audio?.buffer.toString('base64')
    if (!base64 || !audio) {
      apiLogger.warn(
        { app: 'thinkzap', domain, dialogId },
        'audio-upload: audio nao encontrado',
      )
      return this.badRequest(new Error('Audio not found'))
    }

    apiLogger.info(
      {
        app: 'thinkzap',
        domain,
        dialogId,
        userId,
        fileName: audio.originalname,
        fileSizeBytes: audio.buffer.length,
        mimeType: audio.mimetype,
      },
      'audio-upload: iniciando',
    )

    const bitrix = (await makeBitrixClientByDomainAndAppCoode(
      parsedDomain,
      env.appCodes.thinkzap,
      'disk',
    )) as BitrixDiskClient

    let folderId: string
    try {
      folderId = await bitrix.getFolderId({ chatId: dialogId })
    } catch (error) {
      apiLogger.error(
        { app: 'thinkzap', domain, dialogId, phase: 'getFolderId', err: error },
        'audio-upload: falha',
      )
      throw error
    }

    apiLogger.info(
      { app: 'thinkzap', domain, dialogId, folderId },
      'audio-upload: pasta do chat obtida',
    )

    let file: { ID: number; FILE_ID: number }
    try {
      file = await bitrix.uploadFile(
        base64,
        folderId,
        audio.originalname || 'audio.mp3',
      )
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',
          domain,
          dialogId,
          phase: 'uploadFile',
          folderId,
          err: error,
        },
        'audio-upload: falha',
      )
      throw error
    }

    apiLogger.info(
      { app: 'thinkzap', domain, dialogId, folderId, fileId: file.ID },
      'audio-upload: arquivo enviado ao disco',
    )

    let commitFile: { ID: number }
    try {
      commitFile = await bitrix.commitFile(file.ID, dialogId)
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',
          domain,
          dialogId,
          phase: 'commitFile',
          fileId: file.ID,
          err: error,
        },
        'audio-upload: falha',
      )
      throw error
    }

    apiLogger.info(
      {
        app: 'thinkzap',
        domain,
        dialogId,
        fileId: file.ID,
        committedFileId: commitFile.ID,
      },
      'audio-upload: arquivo commitado no chat',
    )

    apiLogger.info(
      {
        app: 'thinkzap',
        domain,
        dialogId,
        userId,
        fileId: file.ID,
        durationMs: Date.now() - startedAt,
      },
      'audio-upload: concluido com sucesso',
    )

    const audioBase64 = audio.buffer.toString('base64')

    return this.ok({
      message: 'Audio uploaded successfully',
      domain,
      dialogId,
      userId,
      audioBase64,
    })
  }
}
