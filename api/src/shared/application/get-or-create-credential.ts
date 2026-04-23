import { CreateCredentialRepository } from '../domain/repositories/credential/create-credential'
import { GetCredentialRepository } from '../domain/repositories/credential/get-credential'
import { Credential } from '../domain/entities/credential'
import { UpdateCredentialRepository } from '../domain/repositories/credential/update-credential'

export class GetOrCreateCredential {
  constructor(
    private readonly credentialRepository: CreateCredentialRepository &
      GetCredentialRepository &
      UpdateCredentialRepository,
  ) {}

  async execute(params: {
    appId: string
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }): Promise<Credential> {
    const credential = await this.credentialRepository.get({
      appId: params.appId,
    })
    if (credential) {
      return this.credentialRepository.update({
        appId: params.appId,
        clientId: params.clientId,
        clientSecret: params.clientSecret,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt: params.expiresAt,
      })
    }
    return this.credentialRepository.create(params)
  }
}
