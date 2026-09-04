import { Credential } from '../../entities/credential'

export interface CreateCredentialRepository {
  // `refreshFailedAttempts` nunca vem do chamador — nasce em 0 (default da coluna).
  create(
    credential: Omit<
      Credential,
      'id' | 'createdAt' | 'updatedAt' | 'refreshFailedAttempts'
    >,
  ): Promise<Credential>
}
