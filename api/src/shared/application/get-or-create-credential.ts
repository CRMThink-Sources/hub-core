import { CreateCredentialRepository } from "../domain/repositories/credential/create-credential";
import { GetCredentialRepository } from "../domain/repositories/credential/get-credential";
import { Credential } from "../domain/entities/credential";

export class GetOrCreateCredential {
  constructor(private readonly credentialRepository: CreateCredentialRepository & GetCredentialRepository) { }

  async execute(params: { appId: string, clientId: string, clientSecret: string, accessToken: string, refreshToken: string, expiresAt: Date }): Promise<Credential> {
    const credential = await this.credentialRepository.get({ appId: params.appId });
    if (credential) return credential;
    return this.credentialRepository.create(params);
  }
}