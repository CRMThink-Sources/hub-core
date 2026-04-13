import { CreateCredentialRepository } from '@/shared/domain/repositories/credential/create-credential'
import { prisma } from '@/config/prisma.js'
import { Credential } from '@/shared/domain/entities/credential'
import { UpdateCredentialRepository } from '@/shared/domain/repositories/credential/update-credential'
import { ListExpiredCredentialsRepository } from '@/shared/domain/repositories/credential/list-expired-credentials'
import { randomUUID } from 'crypto'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'

export class PrismaCredentialRepository
  implements
    CreateCredentialRepository,
    UpdateCredentialRepository,
    GetCredentialRepository,
    ListExpiredCredentialsRepository
{
  async get(params: { appId: string }): Promise<Credential | null> {
    const credential = await prisma.credential.findUnique({
      where: { appId: params.appId },
    })
    if (!credential) return null
    return {
      id: credential.id,
      appId: credential.appId,
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      accessToken: credential.accessToken ?? '',
      refreshToken: credential.refreshToken,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    }
  }

  async create(
    credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Credential> {
    const newCredential = await prisma.credential.create({
      data: {
        id: randomUUID(),
        appId: credential.appId,
        clientId: credential.clientId,
        clientSecret: credential.clientSecret,
        accessToken: credential.accessToken,
        refreshToken: credential.refreshToken,
        expiresAt: credential.expiresAt,
      },
    })

    return {
      id: newCredential.id,
      appId: newCredential.appId,
      clientId: newCredential.clientId,
      clientSecret: newCredential.clientSecret,
      accessToken: newCredential.accessToken ?? '',
      refreshToken: newCredential.refreshToken,
      expiresAt: newCredential.expiresAt,
      createdAt: newCredential.createdAt,
      updatedAt: newCredential.updatedAt,
    }
  }

  async listExpired(buffer: Date): Promise<Credential[]> {
    const credentials = await prisma.credential.findMany({
      where: { expiresAt: { lte: buffer } },
    })

    return credentials.map(credential => ({
      id: credential.id,
      appId: credential.appId,
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      accessToken: credential.accessToken ?? '',
      refreshToken: credential.refreshToken,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    }))
  }

  async update(
    credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Credential> {
    const updatedCredential = await prisma.credential.update({
      where: { appId: credential.appId },
      data: {
        accessToken: credential.accessToken,
        refreshToken: credential.refreshToken,
        expiresAt: credential.expiresAt,
      },
    })

    return {
      id: updatedCredential.id,
      appId: updatedCredential.appId,
      clientId: updatedCredential.clientId,
      clientSecret: updatedCredential.clientSecret,
      accessToken: updatedCredential.accessToken ?? '',
      refreshToken: updatedCredential.refreshToken,
      expiresAt: updatedCredential.expiresAt,
      createdAt: updatedCredential.createdAt,
      updatedAt: updatedCredential.updatedAt,
    }
  }
}
