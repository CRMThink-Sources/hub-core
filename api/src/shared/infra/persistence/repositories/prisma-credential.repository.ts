import { CreateCredentialRepository } from '@/shared/domain/repositories/credential/create-credential'
import { prisma } from '@/config/prisma.js'
import { Credential } from '@/shared/domain/entities/credential'
import { UpdateCredentialRepository } from '@/shared/domain/repositories/credential/update-credential'
import { ListExpiredCredentialsRepository } from '@/shared/domain/repositories/credential/list-expired-credentials'
import { randomUUID } from 'crypto'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { RecordCredentialRefreshFailureRepository } from '@/shared/domain/repositories/credential/record-refresh-failure'

export class PrismaCredentialRepository
  implements
    CreateCredentialRepository,
    UpdateCredentialRepository,
    GetCredentialRepository,
    ListExpiredCredentialsRepository,
    RecordCredentialRefreshFailureRepository
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
      refreshFailedAttempts: credential.refreshFailedAttempts,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    }
  }

  async create(
    credential: Omit<
      Credential,
      'id' | 'createdAt' | 'updatedAt' | 'refreshFailedAttempts'
    >,
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
      refreshFailedAttempts: newCredential.refreshFailedAttempts,
      createdAt: newCredential.createdAt,
      updatedAt: newCredential.updatedAt,
    }
  }

  async listExpired(
    buffer: Date,
    maxRefreshAttempts: number,
  ): Promise<Credential[]> {
    const credentials = await prisma.credential.findMany({
      where: {
        expiresAt: { lte: buffer },
        refreshFailedAttempts: { lt: maxRefreshAttempts },
      },
      select: {
        id: true,
        appId: true,
        accessToken: true,
        refreshToken: true,
        expiresAt: true,
        refreshFailedAttempts: true,
        createdAt: true,
        updatedAt: true,
        app: {
          select: {
            appCode: {
              select: { code: true, secret: true },
            },
          },
        },
      },
    })

    return credentials.map(credential => {
      return {
        id: credential.id,
        appId: credential.appId,
        clientId: credential.app.appCode.code,
        clientSecret: credential.app.appCode.secret,
        accessToken: credential.accessToken ?? '',
        refreshToken: credential.refreshToken,
        expiresAt: credential.expiresAt,
        refreshFailedAttempts: credential.refreshFailedAttempts,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      }
    })
  }

  async update(
    credential: Omit<
      Credential,
      'id' | 'createdAt' | 'updatedAt' | 'refreshFailedAttempts'
    >,
  ): Promise<Credential> {
    const updatedCredential = await prisma.credential.update({
      where: { appId: credential.appId },
      data: {
        accessToken: credential.accessToken,
        refreshToken: credential.refreshToken,
        expiresAt: credential.expiresAt,
        // Toda escrita de tokens é um recomeço: refresh que deu certo ou
        // reautorização manual. Nos dois casos a credencial volta a ser elegível.
        refreshFailedAttempts: 0,
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
      refreshFailedAttempts: updatedCredential.refreshFailedAttempts,
      createdAt: updatedCredential.createdAt,
      updatedAt: updatedCredential.updatedAt,
    }
  }

  async recordFailure(appId: string): Promise<{ attempts: number }> {
    const updated = await prisma.credential.update({
      where: { appId },
      data: { refreshFailedAttempts: { increment: 1 } },
      select: { refreshFailedAttempts: true },
    })
    return { attempts: updated.refreshFailedAttempts }
  }
}
