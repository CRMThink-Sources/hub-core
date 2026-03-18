import { Credential } from '../../entities/credential'

export interface UpdateCredentialRepository {
  update(
    credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Credential>
}
