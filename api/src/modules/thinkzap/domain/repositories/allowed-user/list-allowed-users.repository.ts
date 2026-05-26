import { AllowedUser } from '../../entities/allowed-user'

export interface ListAllowedUsersRepository {
  listByAppId(appId: string): Promise<AllowedUser[]>
}
