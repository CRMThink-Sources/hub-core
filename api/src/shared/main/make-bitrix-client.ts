import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Request } from 'express'
import { BitrixBiConnectorClient } from '../infra/clients/bitrix-biconnector.client'
import { PrismaAvailableAppRepository } from '../infra/persistence/repositories/prisma-available-app.repository'
import { BitrixDiskClient } from '../infra/clients/bitrix-disk'

const credentialRepo = new PrismaCredentialRepository()
const installedAppRepo = new PrismaInstalledAppRepository()
const availableAppRepo = new PrismaAvailableAppRepository()
const domainRepo = new PrismaDomainRepository()

export const makeBitrixClient = async (
  req: Request,
  client: ClientType = 'bitrix',
): Promise<BitrixClient> => {
  const { domainId, appId } = req

  if (!domainId || !appId) {
    throw new Error('Domain ID and app ID are required')
  }

  const domain = await domainRepo.getDomainById(domainId)

  const app = await installedAppRepo.getByAppCodeAndDomainId(appId, domainId)

  if (!domain || !app) {
    throw new Error('App not found')
  }

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

export const makeBitrixClientByDomainAndAppCoode = async (
  domain: string,
  appCode: string,
  client: ClientType = 'bitrix',
): Promise<BitrixClient | BitrixBiConnectorClient> => {
  const domainEntity = await domainRepo.getDomain(domain)
  if (!domainEntity) throw new Error('Domain not found')

  const availableApp = await availableAppRepo.getById(appCode)
  if (!availableApp) throw new Error('Available app not found')

  const installedApp = await installedAppRepo.getByAppCodeAndDomainId(
    availableApp.id,
    domainEntity.id,
  )
  if (!installedApp) throw new Error('Installed app not found')

  const credential = await credentialRepo.get({ appId: installedApp.id })
  if (!credential) throw new Error('Credential not found')

  const Client = clients[client as keyof typeof clients]

  if (!Client) throw new Error('Client not found')

  return new Client(credential, domainEntity.name)
}

const clients = {
  biconnector: BitrixBiConnectorClient,
  bitrix: BitrixClient,
  disk: BitrixDiskClient,
}

type ClientType = 'disk' | 'bitrix' | 'biconnector'
