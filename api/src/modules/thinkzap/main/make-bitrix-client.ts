import { BitrixDiskClient } from '@/shared/infra/clients/bitrix-disk'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Request } from 'express'

export const makeBitrixClient = async (
  req: Request,
  client: ClientType = 'bitrix',
): Promise<BitrixClient> => {
  const { domainId, appId } = req

  if (!domainId || !appId) {
    throw new Error('Domain ID and app ID are required')
  }

  const getDomainRepo = new PrismaDomainRepository()
  const domain = await getDomainRepo.getDomainById(domainId)

  const getAppRepo = new PrismaInstalledAppRepository()
  const app = await getAppRepo.getByAppCodeAndDomainId(appId, domainId)

  if (!domain || !app) {
    throw new Error('App not found')
  }

  const credentialRepo = new PrismaCredentialRepository()
  const credential = await credentialRepo.get({ appId: app?.id })

  if (!credential) {
    throw new Error('Domain or credential not found')
  }
  const Client = clients[client as keyof typeof clients]
  if (!Client) {
    throw new Error('Client not found')
  }
  const bitrixClient = new Client(credential, domain?.name)
  return bitrixClient
}

const clients = {
  disk: BitrixDiskClient,
  bitrix: BitrixClient,
}

type ClientType = 'disk' | 'bitrix'
