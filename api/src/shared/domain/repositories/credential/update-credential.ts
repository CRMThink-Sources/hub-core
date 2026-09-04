import { Credential } from '../../entities/credential'

export interface UpdateCredentialRepository {
  /**
   * `refreshFailedAttempts` nunca vem do chamador. Toda escrita bem-sucedida de
   * tokens (refresh OK ou reautorização) zera o contador de falhas por dentro —
   * é assim que uma reautorização manual reabilita uma credencial esgotada.
   */
  update(
    credential: Omit<
      Credential,
      'id' | 'createdAt' | 'updatedAt' | 'refreshFailedAttempts'
    >,
  ): Promise<Credential>
}
