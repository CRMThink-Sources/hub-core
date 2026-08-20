import { CreateCredentialRepository } from '../domain/repositories/credential/create-credential'
import { GetCredentialRepository } from '../domain/repositories/credential/get-credential'
import { Credential } from '../domain/entities/credential'
import { UpdateCredentialRepository } from '../domain/repositories/credential/update-credential'

export type UpsertCredentialInput = {
  appId: string
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/**
 * Passo `upsert-credential` da instalação. `core_credentials.app_id` é `@unique`,
 * então a instalação sempre sobrescreve os tokens da instalação anterior em vez
 * de acumular linhas.
 */
export class UpsertCredential {
  constructor(
    private readonly credentialRepository: CreateCredentialRepository &
      GetCredentialRepository &
      UpdateCredentialRepository,
  ) {}

  async execute(input: UpsertCredentialInput): Promise<Credential> {
    const credential = await this.credentialRepository.get({
      appId: input.appId,
    })

    if (credential) {
      return this.credentialRepository.update(input)
    }

    return this.credentialRepository.create(input)
  }
}
