import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import type { Request, Response } from 'express'
import z from 'zod'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixDiskClient } from '@/shared/infra/clients/bitrix-disk'
import {
  makeBitrixClient,
  makeBitrixClientByAppId,
  makeBitrixClientByDomainAndAppCoode,
} from '@/shared/main/make-bitrix-client'
import { env } from '@/config/env'

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
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { dialogId, userId, domain } = params.data

    const parsedDomain = domain.split('://')[1] || ''

    const bitrix = (await makeBitrixClientByDomainAndAppCoode(
      parsedDomain,
      env.appCodes.thinkzap,
      'disk',
    )) as BitrixDiskClient

    const folderId = await bitrix.getFolderId({ chatId: dialogId })

    const base64 = req.file?.buffer.toString('base64')
    if (!base64) {
      return this.badRequest(new Error('Audio not found'))
    }
    const audio = req.file

    const file = await bitrix.uploadFile(
      base64,
      folderId,
      audio?.originalname || 'audio.mp3',
    )

    if (!audio) {
      return this.badRequest(new Error('Campo "audio" obrigatorio'))
    }
    const commitFile = await bitrix.commitFile(file.ID, dialogId)

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
