import { AllowedUser } from '../../entities/allowed-user'

export interface GetAllowedUserRepository {
  getByAppIdAndBitrixUserId(
    appId: string,
    bitrixUserId: string,
  ): Promise<AllowedUser | null>
}
