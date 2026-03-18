import { Credential } from '../../entities/credential'

export interface ListExpiredCredentialsRepository {
  listExpired(buffer: Date): Promise<Credential[]>
}
