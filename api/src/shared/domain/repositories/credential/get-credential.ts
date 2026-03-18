import { Credential } from '../../entities/credential'

export interface GetCredentialRepository {
  get(params: { appId: string }): Promise<Credential | null>
}
