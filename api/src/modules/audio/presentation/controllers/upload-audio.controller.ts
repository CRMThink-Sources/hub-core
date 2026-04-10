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
    const domainEntity = await this.getDomainRepository.getDomain(
      domain.split('://')[1] || '',
    )
    if (!domainEntity) {
      return this.notFound(new Error('Domain not found'))
    }

    const availableApp =
      await this.getAvailableAppRepository.getById('crmthink_thinkzap')
    if (!availableApp) {
      return this.notFound(new Error('Available app not found'))
    }

    const installedApp =
      await this.getInstalledAppRepository.getByAppCodeAndDomainId(
        availableApp.id,
        domainEntity.id,
      )

    if (!installedApp) {
      return this.notFound(new Error('Installed apps not found'))
    }

    const credential = await this.credentialRepository.get({
      appId: installedApp.id,
    })
    if (!credential) {
      return this.notFound(new Error('Credential not found'))
    }

    const bitrix = new BitrixDiskClient(
      credential,
      domain.split('://')[1] || '',
    )
    const folderId = await bitrix.getFolderId({ chatId: dialogId })
    const base64 = req.file?.buffer.toString('base64')
    if (!base64) {
      return this.badRequest(new Error('Audio not found'))
    }
    const audio = req.file
    console.log(audio)
    const file = await bitrix.uploadFile(
      base64,
      folderId,
      audio?.originalname || 'audio.mp3',
    )

    if (!audio) {
      return this.badRequest(new Error('Campo "audio" obrigatorio'))
    }
    const commitFile = await bitrix.commitFile(file.ID, dialogId)
    console.log(commitFile)

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
