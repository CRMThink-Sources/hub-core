import { env } from '@/config/env'
import { BitrixDiskClient } from '@/shared/infra/clients/bitrix-disk'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { Controller } from '@/shared/presentation/controller'
import {
  UploadAudioController,
  createBitrixDiskClientWithUserToken,
  type CreateBitrixDiskClientFromApp,
} from '../presentation/controllers/upload-audio.controller'

async function createBitrixDiskClientFromAppCredential(
  domain: string,
): Promise<Pick<BitrixDiskClient, 'uploadFileToChat'>> {
  const client = await makeBitrixClientByDomainAndAppCoode(
    domain,
    env.appCodes.thinkzap,
    'disk',
  )

  return client as Pick<BitrixDiskClient, 'uploadFileToChat'>
}

export const makeUploadAudioController = (): Controller => {
  const domainRepository = new PrismaDomainRepository()
  const createDiskClientFromApp: CreateBitrixDiskClientFromApp =
    createBitrixDiskClientFromAppCredential

  return new UploadAudioController(
    domainRepository,
    createBitrixDiskClientWithUserToken,
    createDiskClientFromApp,
  )
}
