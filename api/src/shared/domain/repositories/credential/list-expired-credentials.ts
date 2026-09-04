import { Credential } from '../../entities/credential'

export interface ListExpiredCredentialsRepository {
  // `maxRefreshAttempts` exclui quem já esgotou as tentativas consecutivas —
  // dono do número é o chamador (o use case), igual `buffer` já era.
  listExpired(buffer: Date, maxRefreshAttempts: number): Promise<Credential[]>
}
