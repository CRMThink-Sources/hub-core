import { prisma } from '@/config/prisma.js'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import {
  DomainCredentialMissingError,
  ThinkzapNotInstalledError,
} from '../domain/errors/portal-domain.errors'

const BUFFER_MS = 5 * 60 * 1000

export type BitrixClientForApp = {
  client: BitrixRestClient
  domainName: string
}

export async function resolveBitrixClientForApp(
  appId: string,
): Promise<BitrixClientForApp> {
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { domain: true },
  })

  if (!app?.domain) {
    throw new ThinkzapNotInstalledError()
  }

  const credentialRepo = new PrismaCredentialRepository()
  const credential = await credentialRepo.get({ appId })

  if (!credential?.accessToken) {
    throw new DomainCredentialMissingError()
  }

  const buffer = new Date(Date.now() + BUFFER_MS)
  let accessToken = credential.accessToken

  if (credential.expiresAt <= buffer) {
    const oauth = new BitrixOAuthClient()
    const refreshed = await oauth.refresh({
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      refreshToken: credential.refreshToken,
    })

    await credentialRepo.update({
      appId: credential.appId,
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    })

    accessToken = refreshed.accessToken
  }

  const client = new BitrixRestClient(app.domain.name, accessToken)

  return { client, domainName: app.domain.name }
}
