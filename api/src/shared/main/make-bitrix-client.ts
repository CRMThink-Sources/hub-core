import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Request } from 'express'
import { BitrixBiConnectorClient } from '../infra/clients/bitrix-biconnector.client'

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

  console.log({ credential })

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

export const makeBitrixClientByAppId = async (
  appId: string,
  client: ClientType = 'bitrix',
): Promise<BitrixClient | BitrixBiConnectorClient> => {
  const credentialRepo = new PrismaCredentialRepository()
  const installedAppRepo = new PrismaInstalledAppRepository()
  const domainRepo = new PrismaDomainRepository()

  const app = await installedAppRepo.getById(appId)
  if (!app) throw new Error('App not found')

  const domain = await domainRepo.getDomainById(app.domainId)
  if (!domain) throw new Error('Domain not found')

  const credential = await credentialRepo.get({ appId })
  if (!credential) throw new Error('Credential not found')

  const Client = clients[client as keyof typeof clients]
  if (!Client) {
    throw new Error('Client not found')
  }
  const bitrixClient = new Client(credential, domain?.name)
  return bitrixClient
}

const clients = {
  biconnector: BitrixBiConnectorClient,
  bitrix: BitrixClient,
  disk: BitrixClient,
}

type ClientType = 'disk' | 'bitrix' | 'biconnector'
